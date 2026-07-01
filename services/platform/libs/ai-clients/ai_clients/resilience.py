from __future__ import annotations

import asyncio
import json
import logging
import os
import threading
import time
from collections.abc import AsyncIterator, Awaitable, Callable, Sequence
from dataclasses import dataclass
from typing import Generic, TypeVar

import httpx

from .errors import AIClientError, CircuitOpenError

logger = logging.getLogger(__name__)

TTarget = TypeVar("TTarget")
TResult = TypeVar("TResult")
TItem = TypeVar("TItem")


@dataclass(frozen=True)
class ResilienceOptions:
    max_attempts: int = 1
    backoff_ms: int = 0
    circuit_failure_threshold: int = 5
    circuit_timeout_seconds: int = 30
    circuit_half_open_max_requests: int = 1


@dataclass(frozen=True)
class ResilientTarget(Generic[TTarget]):
    key: str
    label: str
    value: TTarget


@dataclass
class _CircuitEntry:
    state: str = "CLOSED"
    failure_count: int = 0
    opened_until: float = 0.0
    half_open_in_flight: int = 0


_CIRCUITS: dict[str, _CircuitEntry] = {}
_CIRCUITS_LOCK = threading.Lock()


def _read_int_env(names: Sequence[str | None], default: int) -> int:
    for name in names:
        if not name:
            continue
        raw = (os.getenv(name) or "").strip()
        if not raw:
            continue
        try:
            value = int(raw)
        except ValueError:
            return default
        return value
    return default


def parse_csv_env(name: str) -> list[str]:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return []
    seen: set[str] = set()
    values: list[str] = []
    for item in raw.split(","):
        cleaned = item.strip()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        values.append(cleaned)
    return values


def load_resilience_options(
    service_env_prefix: str,
    *,
    default_max_attempts: int,
    default_backoff_ms: int,
    default_circuit_failure_threshold: int = 5,
    default_circuit_timeout_seconds: int = 30,
    default_circuit_half_open_max_requests: int = 1,
    legacy_max_attempts_env: str | None = None,
    legacy_backoff_env: str | None = None,
) -> ResilienceOptions:
    prefix = service_env_prefix.upper()
    return ResilienceOptions(
        max_attempts=max(
            1,
            _read_int_env(
                [f"{prefix}_RETRY_ATTEMPTS", legacy_max_attempts_env],
                default_max_attempts,
            ),
        ),
        backoff_ms=max(
            0,
            _read_int_env(
                [f"{prefix}_RETRY_BACKOFF_MS", legacy_backoff_env],
                default_backoff_ms,
            ),
        ),
        circuit_failure_threshold=max(
            1,
            _read_int_env(
                [f"{prefix}_CIRCUIT_FAILURE_THRESHOLD"],
                default_circuit_failure_threshold,
            ),
        ),
        circuit_timeout_seconds=max(
            1,
            _read_int_env(
                [f"{prefix}_CIRCUIT_TIMEOUT"],
                default_circuit_timeout_seconds,
            ),
        ),
        circuit_half_open_max_requests=max(
            1,
            _read_int_env(
                [f"{prefix}_CIRCUIT_HALFOPEN_MAX"],
                default_circuit_half_open_max_requests,
            ),
        ),
    )


def reset_circuit_breakers() -> None:
    with _CIRCUITS_LOCK:
        _CIRCUITS.clear()


def get_circuit_state(key: str) -> str:
    with _CIRCUITS_LOCK:
        entry = _CIRCUITS.get(key)
        if entry is None:
            return "CLOSED"
        if entry.state == "OPEN" and entry.opened_until <= time.monotonic():
            entry.state = "HALF_OPEN"
            entry.half_open_in_flight = 0
        return entry.state


def _acquire_target(key: str, options: ResilienceOptions) -> tuple[bool, bool]:
    now = time.monotonic()
    with _CIRCUITS_LOCK:
        entry = _CIRCUITS.setdefault(key, _CircuitEntry())

        if entry.state == "OPEN":
            if entry.opened_until > now:
                return False, False
            entry.state = "HALF_OPEN"
            entry.half_open_in_flight = 0

        if entry.state == "HALF_OPEN":
            if entry.half_open_in_flight >= options.circuit_half_open_max_requests:
                return False, False
            entry.half_open_in_flight += 1
            return True, True

        return True, False


def _record_success(key: str, was_half_open: bool) -> None:
    with _CIRCUITS_LOCK:
        entry = _CIRCUITS.setdefault(key, _CircuitEntry())
        entry.failure_count = 0
        entry.opened_until = 0.0
        if was_half_open:
            entry.half_open_in_flight = 0
        entry.state = "CLOSED"


def _record_non_circuit_failure(key: str, was_half_open: bool) -> None:
    if was_half_open:
        _record_success(key, was_half_open=True)


def _record_failure(key: str, options: ResilienceOptions, was_half_open: bool) -> None:
    now = time.monotonic()
    with _CIRCUITS_LOCK:
        entry = _CIRCUITS.setdefault(key, _CircuitEntry())
        if was_half_open:
            entry.half_open_in_flight = 0
            entry.failure_count = options.circuit_failure_threshold
            entry.state = "OPEN"
            entry.opened_until = now + options.circuit_timeout_seconds
            return

        entry.failure_count += 1
        if entry.failure_count >= options.circuit_failure_threshold:
            entry.state = "OPEN"
            entry.opened_until = now + options.circuit_timeout_seconds


def _should_retry_exception(exc: Exception) -> bool:
    if isinstance(exc, AIClientError):
        return exc.retryable
    if isinstance(exc, httpx.TimeoutException):
        return True
    if isinstance(exc, httpx.NetworkError):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        status_code = exc.response.status_code if exc.response is not None else 0
        return status_code in {408, 409, 425, 429} or status_code >= 500
    return isinstance(exc, ValueError | json.JSONDecodeError)


def _backoff_seconds(options: ResilienceOptions, attempt: int) -> float:
    if options.backoff_ms <= 0:
        return 0.0
    delay_ms = options.backoff_ms * (2 ** max(0, attempt - 1))
    return min(delay_ms / 1000.0, 5.0)


async def execute_with_resilience(
    *,
    service_name: str,
    targets: Sequence[ResilientTarget[TTarget]],
    operation: Callable[[TTarget], Awaitable[TResult]],
    options: ResilienceOptions,
) -> TResult:
    max_attempts = max(1, options.max_attempts)
    failures: list[AIClientError] = []

    for target_index, target in enumerate(targets):
        allowed, was_half_open = _acquire_target(target.key, options)
        if not allowed:
            error = CircuitOpenError(
                service_name,
                target.label,
                timeout_seconds=options.circuit_timeout_seconds,
            )
            failures.append(error)
            logger.warning("%s skipped %s because circuit is open", service_name, target.label)
            continue

        for attempt in range(1, max_attempts + 1):
            try:
                result = await operation(target.value)
            except Exception as exc:
                retryable = _should_retry_exception(exc)
                error = AIClientError.from_exception(
                    service_name,
                    target.label,
                    attempt,
                    exc,
                    retryable=retryable,
                )
                if retryable:
                    _record_failure(target.key, options, was_half_open)
                else:
                    _record_non_circuit_failure(target.key, was_half_open)

                failures.append(error)
                circuit_state = get_circuit_state(target.key)
                if retryable and attempt < max_attempts and circuit_state != "OPEN":
                    delay = _backoff_seconds(options, attempt)
                    logger.warning(
                        "%s retrying %s attempt %s/%s after error: %s",
                        service_name,
                        target.label,
                        attempt + 1,
                        max_attempts,
                        error,
                    )
                    if delay > 0:
                        await asyncio.sleep(delay)
                    continue

                if target_index + 1 < len(targets):
                    logger.warning(
                        "%s falling back from %s to next target after error: %s",
                        service_name,
                        target.label,
                        error,
                    )
                break
            else:
                _record_success(target.key, was_half_open)
                if target_index > 0:
                    logger.warning("%s recovered via fallback target %s", service_name, target.label)
                return result

    if failures:
        raise failures[-1]
    raise AIClientError(service_name, f"{service_name} request failed with no available targets")


async def iterate_with_resilience(
    *,
    service_name: str,
    targets: Sequence[ResilientTarget[TTarget]],
    operation: Callable[[TTarget], AsyncIterator[TItem]],
    options: ResilienceOptions,
) -> AsyncIterator[TItem]:
    max_attempts = max(1, options.max_attempts)
    failures: list[AIClientError] = []

    for target_index, target in enumerate(targets):
        allowed, was_half_open = _acquire_target(target.key, options)
        if not allowed:
            error = CircuitOpenError(
                service_name,
                target.label,
                timeout_seconds=options.circuit_timeout_seconds,
            )
            failures.append(error)
            logger.warning("%s skipped %s because circuit is open", service_name, target.label)
            continue

        for attempt in range(1, max_attempts + 1):
            yielded_any = False
            try:
                async for item in operation(target.value):
                    yielded_any = True
                    yield item
            except Exception as exc:
                retryable = _should_retry_exception(exc)
                error = AIClientError.from_exception(
                    service_name,
                    target.label,
                    attempt,
                    exc,
                    retryable=retryable,
                )
                if retryable:
                    _record_failure(target.key, options, was_half_open)
                else:
                    _record_non_circuit_failure(target.key, was_half_open)

                if yielded_any:
                    raise error from exc

                failures.append(error)
                circuit_state = get_circuit_state(target.key)
                if retryable and attempt < max_attempts and circuit_state != "OPEN":
                    delay = _backoff_seconds(options, attempt)
                    logger.warning(
                        "%s retrying stream %s attempt %s/%s after error: %s",
                        service_name,
                        target.label,
                        attempt + 1,
                        max_attempts,
                        error,
                    )
                    if delay > 0:
                        await asyncio.sleep(delay)
                    continue

                if target_index + 1 < len(targets):
                    logger.warning(
                        "%s falling back stream from %s to next target after error: %s",
                        service_name,
                        target.label,
                        error,
                    )
                break
            else:
                _record_success(target.key, was_half_open)
                if target_index > 0:
                    logger.warning(
                        "%s recovered stream via fallback target %s",
                        service_name,
                        target.label,
                    )
                return

    if failures:
        raise failures[-1]
    raise AIClientError(service_name, f"{service_name} stream failed with no available targets")
