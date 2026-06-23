from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.config import ETL_BATCH_MAX_SIZE
from app.transform_load import BatchLoadError, BatchLoadProcessor

logger = logging.getLogger(__name__)


def _run_id() -> str:
    return f"run_{uuid4().hex[:12]}"


def _local_tz():
    return datetime.now().astimezone().tzinfo or timezone.utc


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc).astimezone(_local_tz())
    return value.astimezone(_local_tz())


def _minute_floor(value: datetime) -> datetime:
    return value.replace(second=0, microsecond=0)


def _field_match(token: str, value: int, minimum: int, maximum: int) -> bool:
    token = token.strip()
    if token == "*":
        return True
    if token.startswith("*/"):
        step = int(token[2:])
        return step > 0 and value % step == 0
    if "," in token:
        return any(_field_match(part, value, minimum, maximum) for part in token.split(","))
    if "-" in token:
        start_text, end_text = token.split("-", 1)
        start = int(start_text)
        end = int(end_text)
        return start <= value <= end
    number = int(token)
    return minimum <= number <= maximum and value == number


def cron_matches(expr: str, when: datetime) -> bool:
    parts = [part for part in str(expr or "").split() if part]
    if len(parts) != 5:
        raise ValueError(f"invalid cron expression: {expr!r}")
    minute, hour, day, month, weekday = parts
    checks = (
        _field_match(minute, when.minute, 0, 59),
        _field_match(hour, when.hour, 0, 23),
        _field_match(day, when.day, 1, 31),
        _field_match(month, when.month, 1, 12),
        _field_match(weekday, (when.weekday() + 1) % 7, 0, 6),
    )
    return all(checks)


class BatchScheduler:
    def __init__(self, store, connector, poll_seconds: int = 15, load_processor=None):
        self.store = store
        self.connector = connector
        self.poll_seconds = max(5, int(poll_seconds))
        self._tasks: set[asyncio.Task] = set()
        self._tick_lock = asyncio.Lock()
        self.load_processor = load_processor or BatchLoadProcessor()

    async def run_loop(self, stop_event: asyncio.Event) -> None:
        while not stop_event.is_set():
            try:
                await self.tick()
            except Exception:
                logger.exception("batch scheduler tick failed")
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=self.poll_seconds)
            except TimeoutError:
                continue

    async def shutdown(self) -> None:
        tasks = list(self._tasks)
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        self._tasks.clear()
        await self.load_processor.close()

    async def tick(self, now: datetime | None = None, spawn: bool = True) -> dict[str, Any]:
        async with self._tick_lock:
            current = _aware(now or datetime.now(timezone.utc))
            jobs = await self.store.list_jobs()
            summary = {
                "checked": 0,
                "eligible": 0,
                "triggered": [],
                "skipped": [],
                "at": current.isoformat(),
            }
            for job in jobs:
                summary["checked"] += 1
                if not self._is_batch_job(job):
                    summary["skipped"].append({"jobId": job["jobId"], "reason": "not-eligible"})
                    continue
                summary["eligible"] += 1
                runs = await self.store.list_runs(job["jobId"])
                reason = self._due_reason(job, runs, current)
                if reason is not None:
                    summary["skipped"].append({"jobId": job["jobId"], "reason": reason})
                    continue
                source_range = self._build_source_range(job, runs, current)
                run = await self.store.create_run(
                    job["jobId"],
                    {
                        "runId": _run_id(),
                        "triggerType": "schedule",
                        "sourceRange": source_range,
                    },
                )
                summary["triggered"].append(run["runId"])
                if spawn:
                    task = asyncio.create_task(self.execute_run(job, run))
                    self._tasks.add(task)
                    task.add_done_callback(self._tasks.discard)
                else:
                    await self.execute_run(job, run)
            return summary

    async def execute_run(self, job: dict[str, Any], run: dict[str, Any]) -> dict[str, Any]:
        run_id = run["runId"]
        source_range = dict(run.get("sourceRange") or {})
        source_system = "etl"
        try:
            source = await self.store.get_source(job["sourceId"])
            source_system = str(source.get("sourceSystem") or "etl")
            job_config = dict(job.get("jobConfig") or {})
            table_name = str(job_config.get("sourceTable") or "").strip()
            if not table_name:
                raise ValueError("jobConfig.sourceTable is required for batch sync")

            batch_size = int(job_config.get("batchSize") or 100)
            batch_size = max(1, min(batch_size, ETL_BATCH_MAX_SIZE))
            cursor_column = str(job_config.get("cursorColumn") or "").strip() or None
            order_by = str(job_config.get("orderBy") or cursor_column or "").strip() or None
            read_payload = {
                "schemaName": job_config.get("sourceSchema") or "dbo",
                "tableName": table_name,
                "columns": list(job_config.get("columns") or []),
                "limit": batch_size,
                "cursorColumn": cursor_column,
                "cursorValue": source_range.get("cursorValue"),
                "orderBy": order_by,
                "descending": bool(job_config.get("descending", False)),
            }
            await self.store.update_run(
                run_id,
                {
                    "status": "running",
                    "sourceRange": {
                        **source_range,
                        "jobMode": "batch",
                        "phase": "extract",
                        "readRequest": read_payload,
                    },
                },
            )
            result = await self.connector.read_rows(source, read_payload)
            load_summary = await self.load_processor.process(
                job,
                run,
                source,
                result,
                self.store,
            )
            enriched_range = {
                **source_range,
                "jobMode": "batch",
                "phase": "loaded",
                "tableName": result["tableName"],
                "schemaName": result["schemaName"],
                "batchCount": result["count"],
                "nextCursor": result.get("nextCursor"),
                "cursorColumn": read_payload.get("cursorColumn"),
                "cursorValue": read_payload.get("cursorValue"),
                "loadSummary": load_summary,
                "completedAt": datetime.now(timezone.utc).isoformat(),
            }
            await self.store.update_run(
                run_id,
                {
                    "status": "completed",
                    "recordIn": result["count"],
                    "recordOut": int(load_summary.get("recordOut") or 0),
                    "sourceRange": enriched_range,
                },
            )
            return result
        except Exception as exc:
            logger.exception("batch run failed runId=%s jobId=%s", run_id, job.get("jobId"))
            stage = exc.stage if isinstance(exc, BatchLoadError) else "extract"
            retryable = exc.retryable if isinstance(exc, BatchLoadError) else True
            detail = exc.detail if isinstance(exc, BatchLoadError) else {"jobId": job.get("jobId"), "runId": run_id}
            await self.store.add_error(
                run_id,
                {
                    "sourceSystem": source_system,
                    "stage": stage,
                    "errorCode": exc.code if isinstance(exc, BatchLoadError) else exc.__class__.__name__,
                    "errorMessage": str(exc),
                    "detail": detail,
                    "retryable": retryable,
                },
            )
            await self.store.update_run(
                run_id,
                {
                    "status": "failed",
                    "errorSummary": str(exc),
                    "sourceRange": {
                        **source_range,
                        "jobMode": "batch",
                        "phase": stage,
                        "failedAt": datetime.now(timezone.utc).isoformat(),
                    },
                },
            )
            raise

    def _is_batch_job(self, job: dict[str, Any]) -> bool:
        return (
            job.get("syncMode") == "batch"
            and job.get("status") == "active"
            and bool(str(job.get("scheduleCron") or "").strip())
        )

    def _due_reason(self, job: dict[str, Any], runs: list[dict[str, Any]], now: datetime) -> str | None:
        expr = str(job.get("scheduleCron") or "").strip()
        try:
            if not cron_matches(expr, now):
                return "not-due"
        except ValueError:
            return "invalid-cron"
        if any(run.get("status") in {"queued", "running"} for run in runs):
            return "inflight"
        minute_start = _minute_floor(now)
        slot_key = minute_start.isoformat()
        for run in runs:
            source_range = dict(run.get("sourceRange") or {})
            if source_range.get("scheduledFor") == slot_key:
                return "already-triggered"
        return None

    def _build_source_range(self, job: dict[str, Any], runs: list[dict[str, Any]], now: datetime) -> dict[str, Any]:
        job_config = dict(job.get("jobConfig") or {})
        latest_completed = next((run for run in runs if run.get("status") == "completed"), None)
        previous_range = dict((latest_completed or {}).get("sourceRange") or {})
        cursor_column = str(job_config.get("cursorColumn") or "").strip() or None
        cursor_value = previous_range.get("nextCursor")
        if cursor_value is None:
            cursor_value = job_config.get("initialCursorValue")
        return {
            "scheduledFor": _minute_floor(now).isoformat(),
            "cursorColumn": cursor_column,
            "cursorValue": cursor_value,
            "scheduleCron": job.get("scheduleCron"),
        }
