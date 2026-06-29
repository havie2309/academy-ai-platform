import asyncio
import os
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

from fastapi.testclient import TestClient

os.environ["ETL_STORE_BACKEND"] = "memory"
os.environ["ETL_SCHEDULER_ENABLED"] = "false"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main  # noqa: E402
from app.batch_sync import BatchScheduler, cron_matches  # noqa: E402
from app.connectors.sqlserver import SqlServerConnector  # noqa: E402
from app.transform_load import BatchLoadProcessor  # noqa: E402


class FakeSqlServerAdapter:
    def __init__(self):
        self.calls: list[dict] = []

    def fetch_all(self, _config, query, params):
        self.calls.append({"query": query, "params": list(params)})
        normalized = " ".join(query.split())
        if "HAS_PERMS_BY_NAME" in normalized:
            return [
                {
                    "database_name": "PM_SOURCE",
                    "server_name": "PM-SQL01",
                    "login_name": "etl_reader",
                    "can_select": 1,
                    "can_insert": 0,
                    "can_update": 0,
                    "can_delete": 0,
                }
            ]
        if "FROM INFORMATION_SCHEMA.TABLES" in normalized:
            return [
                {"schema_name": "dbo", "table_name": "hoc_vien"},
                {"schema_name": "dbo", "table_name": "diem"},
                {"schema_name": "admin", "table_name": "secret_table"},
            ]
        if "FROM INFORMATION_SCHEMA.COLUMNS" in normalized:
            return [
                {
                    "column_name": "ma_hv",
                    "data_type": "varchar",
                    "is_nullable": "NO",
                    "max_length": 50,
                    "numeric_precision": None,
                    "numeric_scale": None,
                    "ordinal_position": 1,
                },
                {
                    "column_name": "ho_ten",
                    "data_type": "nvarchar",
                    "is_nullable": "YES",
                    "max_length": 255,
                    "numeric_precision": None,
                    "numeric_scale": None,
                    "ordinal_position": 2,
                },
                {
                    "column_name": "updated_at",
                    "data_type": "datetime",
                    "is_nullable": "NO",
                    "max_length": None,
                    "numeric_precision": None,
                    "numeric_scale": None,
                    "ordinal_position": 3,
                },
            ]
        return [
            {"ma_hv": "HV001", "ho_ten": "Nguyen Van A", "updated_at": "2026-06-17T08:00:00"},
            {"ma_hv": "HV002", "ho_ten": "Tran Thi B", "updated_at": "2026-06-18T08:00:00"},
        ]


class FakePostgresTargetWriter:
    def __init__(self):
        self.calls: list[dict] = []

    async def upsert_rows(self, target_table: str, rows: list[dict], key_fields: list[str]):
        self.calls.append(
            {
                "targetTable": target_table,
                "rows": [dict(row) for row in rows],
                "keyFields": list(key_fields),
            }
        )
        return ["|".join(str(row[key]) for key in key_fields) for row in rows]

    async def close(self):
        return None


class FakeMongoTargetWriter:
    def __init__(self):
        self.calls: list[dict] = []

    async def upsert_rows(
        self,
        target_collection: str,
        rows: list[dict],
        key_fields: list[str],
        metadata: dict,
    ):
        self.calls.append(
            {
                "targetCollection": target_collection,
                "rows": [dict(row) for row in rows],
                "keyFields": list(key_fields),
                "metadata": dict(metadata),
            }
        )
        results: list[str] = []
        for row in rows:
            if key_fields:
                results.append("|".join(str(row[key]) for key in key_fields))
            else:
                results.append(str(len(results) + 1))
        return results

    async def close(self):
        return None


class EtlSyncApiTests(unittest.TestCase):
    def setUp(self):
        self.client_ctx = TestClient(main.app)
        self.client = self.client_ctx.__enter__()
        self.sql_adapter = FakeSqlServerAdapter()
        main.app.state.sqlserver_connector = SqlServerConnector(adapter=self.sql_adapter)
        self.admin_headers = {
            "x-gateway-user-id": "admin-1",
            "x-gateway-username": "admin",
            "x-gateway-roles": "ADMIN",
            "x-gateway-normalized-roles": "ADMIN",
            "x-gateway-max-security-level": "4",
        }
        self.client.headers.update(self.admin_headers)

    def tearDown(self):
        self.client_ctx.__exit__(None, None, None)

    def _gateway_headers(
        self,
        user_id: str,
        username: str,
        roles: list[str] | tuple[str, ...],
        department: str | None = None,
        max_security_level: str = "3",
    ) -> dict[str, str]:
        joined_roles = ",".join(roles)
        headers = {
            "x-gateway-user-id": user_id,
            "x-gateway-username": username,
            "x-gateway-roles": joined_roles,
            "x-gateway-normalized-roles": joined_roles,
            "x-gateway-max-security-level": max_security_level,
        }
        if department:
            headers["x-gateway-department"] = department
        return headers

    def _bootstrap_run(self) -> tuple[str, str, str]:
        source = self.client.post(
            "/v1/etl/sources",
            json={
                "sourceSystem": "pm_dao_tao",
                "displayName": "Training Source",
                "sourceKind": "mock",
                "connectionConfig": {"dsn": "mock://training"},
            },
        )
        self.assertEqual(source.status_code, 200)
        source_id = source.json()["sourceId"]

        job = self.client.post(
            "/v1/etl/jobs",
            json={
                "sourceId": source_id,
                "domainCode": "dao_tao",
                "syncMode": "batch",
                "targetTable": "hoc_vien",
                "status": "active",
                "createdBy": "admin",
            },
        )
        self.assertEqual(job.status_code, 200)
        job_id = job.json()["jobId"]

        run = self.client.post(
            f"/v1/etl/jobs/{job_id}/runs",
            json={
                "sourceRange": {"from": "2026-01-01", "to": "2026-06-19"},
                "triggerType": "manual",
                "triggeredBy": "admin",
            },
        )
        self.assertEqual(run.status_code, 200)
        run_id = run.json()["runId"]
        return source_id, job_id, run_id

    def _bootstrap_sqlserver_source(self, table_allowlist=None) -> str:
        source = self.client.post(
            "/v1/etl/sources",
            json={
                "sourceSystem": "pm_dao_tao",
                "displayName": "PM SQL Server",
                "sourceKind": "sqlserver",
                "connectionConfig": {
                    "host": "pm-sql01.internal",
                    "port": 1433,
                    "database": "PM_SOURCE",
                    "username": "etl_reader",
                    "password": "super-secret-pass",
                    "schemaAllowlist": ["dbo"],
                    "tableAllowlist": table_allowlist or ["dbo.hoc_vien", "dbo.diem"],
                },
            },
        )
        self.assertEqual(source.status_code, 200)
        payload = source.json()
        self.assertEqual(payload["sourceKind"], "sqlserver")
        self.assertEqual(payload["connectionConfig"]["password"], "su***ss")
        return payload["sourceId"]

    def test_health_and_overview_start_empty(self):
        health = self.client.get("/health")
        self.assertEqual(health.status_code, 200)
        payload = health.json()
        self.assertEqual(payload["service"], "etl-sync")
        self.assertEqual(payload["backend"], "memory")

        overview = self.client.get("/v1/etl/overview")
        self.assertEqual(overview.status_code, 200)
        self.assertEqual(
            overview.json(),
            {
                "backend": "memory",
                "sources": 0,
                "jobs": 0,
                "runs": 0,
                "queuedRuns": 0,
                "runningRuns": 0,
                "failedRuns": 0,
            },
        )

    def test_create_source_job_and_run(self):
        source_id, job_id, run_id = self._bootstrap_run()

        sources = self.client.get("/v1/etl/sources")
        self.assertEqual(sources.status_code, 200)
        self.assertEqual(sources.json()[0]["sourceId"], source_id)

        jobs = self.client.get("/v1/etl/jobs")
        self.assertEqual(jobs.status_code, 200)
        self.assertEqual(jobs.json()[0]["jobId"], job_id)
        self.assertEqual(jobs.json()[0]["createdBy"], "admin-1")

        runs = self.client.get("/v1/etl/runs")
        self.assertEqual(runs.status_code, 200)
        self.assertEqual(runs.json()[0]["runId"], run_id)
        self.assertEqual(runs.json()[0]["status"], "queued")
        self.assertEqual(runs.json()[0]["triggeredBy"], "admin-1")

        detail = self.client.get(f"/v1/etl/runs/{run_id}")
        self.assertEqual(detail.status_code, 200)
        payload = detail.json()
        self.assertEqual(payload["jobId"], job_id)
        self.assertEqual(payload["sourceSystem"], "pm_dao_tao")
        self.assertEqual(payload["syncMode"], "batch")
        self.assertEqual(payload["lineage"], [])
        self.assertEqual(payload["errors"], [])

    def test_update_run_and_append_lineage_and_error(self):
        _, _, run_id = self._bootstrap_run()

        running = self.client.post(
            f"/v1/etl/runs/{run_id}/status",
            json={"status": "running", "recordIn": 12},
        )
        self.assertEqual(running.status_code, 200)
        self.assertEqual(running.json()["status"], "running")
        self.assertEqual(running.json()["recordIn"], 12)
        self.assertIsNotNone(running.json()["startedAt"])

        lineage = self.client.post(
            f"/v1/etl/runs/{run_id}/lineage",
            json={
                "sourceSystem": "pm_dao_tao",
                "sourceTable": "sv_hoc_vien",
                "sourcePk": "HV001",
                "targetTable": "hoc_vien",
                "targetPk": "HV001",
                "operation": "upsert",
                "status": "applied",
            },
        )
        self.assertEqual(lineage.status_code, 200)
        self.assertEqual(lineage.json()["sourcePk"], "HV001")

        error = self.client.post(
            f"/v1/etl/runs/{run_id}/errors",
            json={
                "sourceSystem": "pm_dao_tao",
                "stage": "load",
                "errorCode": "DUP_KEY",
                "errorMessage": "duplicate target row",
                "detail": {"row": "HV002"},
                "retryable": True,
            },
        )
        self.assertEqual(error.status_code, 200)
        self.assertEqual(error.json()["stage"], "load")
        self.assertTrue(error.json()["retryable"])

        failed = self.client.post(
            f"/v1/etl/runs/{run_id}/status",
            json={"status": "failed", "recordOut": 11, "errorSummary": "1 row failed"},
        )
        self.assertEqual(failed.status_code, 200)
        self.assertEqual(failed.json()["status"], "failed")
        self.assertEqual(failed.json()["recordOut"], 11)
        self.assertIsNotNone(failed.json()["finishedAt"])

        detail = self.client.get(f"/v1/etl/runs/{run_id}")
        self.assertEqual(detail.status_code, 200)
        payload = detail.json()
        self.assertEqual(len(payload["lineage"]), 1)
        self.assertEqual(len(payload["errors"]), 1)
        self.assertEqual(payload["errorSummary"], "1 row failed")
        self.assertEqual(payload["errors"][0]["errorCode"], "DUP_KEY")

    def test_sqlserver_ping_and_catalog_endpoints(self):
        source_id = self._bootstrap_sqlserver_source()

        ping = self.client.post(f"/v1/etl/sources/{source_id}/sqlserver/ping")
        self.assertEqual(ping.status_code, 200)
        payload = ping.json()
        self.assertEqual(payload["connectorMode"], "read-only")
        self.assertEqual(payload["databaseName"], "PM_SOURCE")
        self.assertTrue(payload["permissions"]["canSelect"])
        self.assertFalse(payload["readOnlyPolicy"]["dbWritePermissionsDetected"])

        tables = self.client.get(f"/v1/etl/sources/{source_id}/sqlserver/tables")
        self.assertEqual(tables.status_code, 200)
        self.assertEqual(
            tables.json(),
            [
                {"schemaName": "dbo", "tableName": "hoc_vien"},
                {"schemaName": "dbo", "tableName": "diem"},
            ],
        )

        columns = self.client.get(
            f"/v1/etl/sources/{source_id}/sqlserver/tables/hoc_vien/columns",
            params={"schemaName": "dbo"},
        )
        self.assertEqual(columns.status_code, 200)
        self.assertEqual(columns.json()[0]["columnName"], "ma_hv")
        self.assertEqual(columns.json()[2]["columnName"], "updated_at")

    def test_sqlserver_read_endpoint_builds_select_only_query(self):
        source_id = self._bootstrap_sqlserver_source()

        read = self.client.post(
            f"/v1/etl/sources/{source_id}/sqlserver/read",
            json={
                "schemaName": "dbo",
                "tableName": "hoc_vien",
                "columns": ["ma_hv", "ho_ten", "updated_at"],
                "limit": 2,
                "cursorColumn": "updated_at",
                "cursorValue": "2026-06-16T00:00:00",
                "orderBy": "updated_at",
            },
        )
        self.assertEqual(read.status_code, 200)
        payload = read.json()
        self.assertEqual(payload["count"], 2)
        self.assertEqual(payload["nextCursor"], "2026-06-18T08:00:00")
        self.assertEqual(payload["rows"][0]["ma_hv"], "HV001")

        last_call = self.sql_adapter.calls[-1]
        self.assertIn("SELECT TOP (2)", last_call["query"])
        self.assertIn("FROM [dbo].[hoc_vien]", last_call["query"])
        self.assertIn("WHERE [updated_at] > %s", last_call["query"])
        self.assertEqual(last_call["params"], ["2026-06-16T00:00:00"])

    def test_sqlserver_read_blocks_table_outside_allowlist(self):
        source_id = self._bootstrap_sqlserver_source(table_allowlist=["dbo.hoc_vien"])

        read = self.client.post(
            f"/v1/etl/sources/{source_id}/sqlserver/read",
            json={
                "schemaName": "dbo",
                "tableName": "diem",
                "columns": ["ma_hv"],
                "limit": 1,
            },
        )
        self.assertEqual(read.status_code, 403)
        self.assertIn("table not allowed", read.json()["detail"])

    def test_requires_gateway_headers_for_etl_routes(self):
        with TestClient(main.app) as raw_client:
            health = raw_client.get("/health")
            self.assertEqual(health.status_code, 200)

            overview = raw_client.get("/v1/etl/overview")
            self.assertEqual(overview.status_code, 401)
            self.assertEqual(overview.json()["detail"], "gateway-authenticated user required")

    def test_rejects_non_admin_gateway_user(self):
        student_headers = self._gateway_headers(
            "hv001",
            "hv001",
            ["HOC_VIEN"],
            department="P2",
            max_security_level="1",
        )
        overview = self.client.get("/v1/etl/overview", headers=student_headers)
        self.assertEqual(overview.status_code, 403)
        self.assertEqual(overview.json()["detail"], "etl access requires operator role")

    def test_only_admin_can_configure_sources_and_jobs(self):
        p2_headers = self._gateway_headers("USR_P2", "p2_01", ["P2"], department="P2")

        source = self.client.post(
            "/v1/etl/sources",
            json={
                "sourceSystem": "pm_dao_tao",
                "displayName": "Training Source",
                "sourceKind": "mock",
                "connectionConfig": {"dsn": "mock://training"},
            },
            headers=p2_headers,
        )
        self.assertEqual(source.status_code, 403)
        self.assertEqual(source.json()["detail"], "etl configuration requires admin role")

    def test_matching_operator_can_view_and_run_scoped_job(self):
        source = self.client.post(
            "/v1/etl/sources",
            json={
                "sourceSystem": "pm_dao_tao",
                "displayName": "Training Source",
                "sourceKind": "mock",
                "connectionConfig": {"dsn": "mock://training"},
            },
        )
        self.assertEqual(source.status_code, 200)
        source_id = source.json()["sourceId"]

        job = self.client.post(
            "/v1/etl/jobs",
            json={
                "sourceId": source_id,
                "domainCode": "dao_tao",
                "syncMode": "manual",
                "targetTable": "hoc_vien",
                "jobConfig": {
                    "accessPolicy": {
                        "viewRoles": ["P2", "BGD"],
                        "runRoles": ["P2"],
                    }
                },
                "status": "active",
            },
        )
        self.assertEqual(job.status_code, 200)
        job_id = job.json()["jobId"]

        p2_headers = self._gateway_headers("USR_P2", "p2_01", ["P2"], department="P2")
        bgd_headers = self._gateway_headers("USR_BGD", "bgd_01", ["BGD"], department="BGD")

        p2_job = self.client.get(f"/v1/etl/jobs/{job_id}", headers=p2_headers)
        self.assertEqual(p2_job.status_code, 200)

        p2_run = self.client.post(
            f"/v1/etl/jobs/{job_id}/runs",
            json={"triggerType": "manual"},
            headers=p2_headers,
        )
        self.assertEqual(p2_run.status_code, 200)
        run_id = p2_run.json()["runId"]
        self.assertEqual(p2_run.json()["triggeredBy"], "USR_P2")

        p2_detail = self.client.get(f"/v1/etl/runs/{run_id}", headers=p2_headers)
        self.assertEqual(p2_detail.status_code, 200)
        self.assertNotIn("lineage", p2_detail.json())
        self.assertNotIn("errors", p2_detail.json())

        bgd_job = self.client.get(f"/v1/etl/jobs/{job_id}", headers=bgd_headers)
        self.assertEqual(bgd_job.status_code, 200)

        bgd_run = self.client.post(
            f"/v1/etl/jobs/{job_id}/runs",
            json={"triggerType": "manual"},
            headers=bgd_headers,
        )
        self.assertEqual(bgd_run.status_code, 403)
        self.assertEqual(bgd_run.json()["detail"], "etl job is outside your scope")

    def test_domain_default_scope_allows_p7_for_khao_thi_job(self):
        source = self.client.post(
            "/v1/etl/sources",
            json={
                "sourceSystem": "pm_khao_thi",
                "displayName": "Exam Source",
                "sourceKind": "mock",
                "connectionConfig": {"dsn": "mock://exam"},
            },
        )
        self.assertEqual(source.status_code, 200)
        source_id = source.json()["sourceId"]

        job = self.client.post(
            "/v1/etl/jobs",
            json={
                "sourceId": source_id,
                "domainCode": "khao_thi",
                "syncMode": "manual",
                "targetTable": "exam_banks",
                "status": "active",
            },
        )
        self.assertEqual(job.status_code, 200)
        job_id = job.json()["jobId"]

        p7_headers = self._gateway_headers("USR_P7", "p7_01", ["P7"], department="P7")
        p2_headers = self._gateway_headers("USR_P2", "p2_01", ["P2"], department="P2")

        p7_job = self.client.get(f"/v1/etl/jobs/{job_id}", headers=p7_headers)
        self.assertEqual(p7_job.status_code, 200)

        p7_run = self.client.post(
            f"/v1/etl/jobs/{job_id}/runs",
            json={"triggerType": "manual"},
            headers=p7_headers,
        )
        self.assertEqual(p7_run.status_code, 200)
        self.assertEqual(p7_run.json()["triggeredBy"], "USR_P7")

        p2_job = self.client.get(f"/v1/etl/jobs/{job_id}", headers=p2_headers)
        self.assertEqual(p2_job.status_code, 403)
        self.assertEqual(p2_job.json()["detail"], "etl job is outside your scope")

    def test_cron_match_supports_step_and_exact_fields(self):
        at = datetime(2026, 6, 20, 10, 15, tzinfo=timezone.utc)
        self.assertTrue(cron_matches("*/5 * * * *", at))
        self.assertTrue(cron_matches("15 10 * * 6", at))
        self.assertFalse(cron_matches("10 10 * * *", at))

    def test_batch_scheduler_triggers_due_job_once_per_slot(self):
        source_id = self._bootstrap_sqlserver_source()
        job = self.client.post(
            "/v1/etl/jobs",
            json={
                "sourceId": source_id,
                "domainCode": "dao_tao",
                "syncMode": "batch",
                "targetTable": "hoc_vien",
                "targetCollection": "etl_hoc_vien",
                "scheduleCron": "*/5 * * * *",
                "jobConfig": {
                    "sourceSchema": "dbo",
                    "sourceTable": "hoc_vien",
                    "columns": ["ma_hv", "ho_ten", "updated_at"],
                    "cursorColumn": "updated_at",
                    "orderBy": "updated_at",
                    "primaryKeyColumn": "ma_hv",
                    "fieldMappings": {"ma_hv": "id"},
                    "targetKeyColumns": ["id"],
                    "requiredFields": ["id", "ho_ten"],
                    "staticFields": {"active": True},
                    "batchSize": 2,
                },
                "status": "active",
            },
        )
        self.assertEqual(job.status_code, 200)
        job_id = job.json()["jobId"]

        processor = BatchLoadProcessor(
            postgres_writer=FakePostgresTargetWriter(),
            mongo_writer=FakeMongoTargetWriter(),
        )
        scheduler = BatchScheduler(
            main.app.state.store,
            main.app.state.sqlserver_connector,
            poll_seconds=15,
            load_processor=processor,
        )
        due_at = datetime(2026, 6, 20, 10, 15, tzinfo=timezone.utc)
        summary = asyncio.run(scheduler.tick(now=due_at, spawn=False))
        self.assertEqual(len(summary["triggered"]), 1)

        runs = self.client.get("/v1/etl/runs", params={"jobId": job_id})
        self.assertEqual(runs.status_code, 200)
        payload = runs.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["status"], "completed")
        self.assertEqual(payload[0]["recordIn"], 2)
        self.assertEqual(payload[0]["recordOut"], 2)
        self.assertEqual(payload[0]["sourceRange"]["nextCursor"], "2026-06-18T08:00:00")
        self.assertEqual(payload[0]["sourceRange"]["loadSummary"]["loadedTargets"], ["postgres", "mongodb"])

        run_id = payload[0]["runId"]
        detail = self.client.get(f"/v1/etl/runs/{run_id}")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(len(detail.json()["lineage"]), 2)
        self.assertEqual(detail.json()["lineage"][0]["status"], "applied")

        same_slot = asyncio.run(scheduler.tick(now=due_at, spawn=False))
        self.assertEqual(len(same_slot["triggered"]), 0)
        self.assertTrue(any(item["reason"] == "already-triggered" for item in same_slot["skipped"]))

        next_due = datetime(2026, 6, 20, 10, 20, tzinfo=timezone.utc)
        second = asyncio.run(scheduler.tick(now=next_due, spawn=False))
        self.assertEqual(len(second["triggered"]), 1)
        self.assertEqual(self.sql_adapter.calls[-1]["params"], ["2026-06-18T08:00:00"])

    def test_batch_load_processor_applies_transform_and_lineage(self):
        source_id = self._bootstrap_sqlserver_source()
        job = self.client.post(
            "/v1/etl/jobs",
            json={
                "sourceId": source_id,
                "domainCode": "dao_tao",
                "syncMode": "manual",
                "targetTable": "hoc_vien",
                "targetCollection": "etl_hoc_vien",
                "jobConfig": {
                    "primaryKeyColumn": "ma_hv",
                    "fieldMappings": {"ma_hv": "id"},
                    "targetKeyColumns": ["id"],
                    "requiredFields": ["id", "ho_ten"],
                    "staticFields": {"active": True},
                },
                "status": "active",
            },
        )
        self.assertEqual(job.status_code, 200)
        job_id = job.json()["jobId"]

        run = self.client.post(
            f"/v1/etl/jobs/{job_id}/runs",
            json={"triggerType": "manual", "triggeredBy": "admin"},
        )
        self.assertEqual(run.status_code, 200)
        run_id = run.json()["runId"]

        store = main.app.state.store
        source = asyncio.run(store.get_source(source_id))
        job_payload = asyncio.run(store.get_job(job_id))
        run_payload = asyncio.run(store.get_run(run_id))

        pg = FakePostgresTargetWriter()
        mongo = FakeMongoTargetWriter()
        processor = BatchLoadProcessor(postgres_writer=pg, mongo_writer=mongo)
        summary = asyncio.run(
            processor.process(
                job_payload,
                run_payload,
                source,
                {
                    "schemaName": "dbo",
                    "tableName": "hoc_vien",
                    "rows": [
                        {"ma_hv": "HV001", "ho_ten": "Nguyen Van A"},
                        {"ma_hv": "HV002", "ho_ten": "Tran Thi B"},
                    ],
                },
                store,
            )
        )

        self.assertEqual(summary["recordOut"], 2)
        self.assertEqual(summary["validationErrors"], 0)
        self.assertEqual(pg.calls[0]["rows"][0]["id"], "HV001")
        self.assertTrue(pg.calls[0]["rows"][0]["active"])
        self.assertEqual(mongo.calls[0]["targetCollection"], "etl_hoc_vien")
        self.assertEqual(mongo.calls[0]["metadata"]["runId"], run_id)

        detail = self.client.get(f"/v1/etl/runs/{run_id}")
        self.assertEqual(detail.status_code, 200)
        payload = detail.json()
        self.assertEqual(len(payload["lineage"]), 2)
        self.assertEqual(payload["lineage"][0]["status"], "applied")
        self.assertEqual(payload["errors"], [])

    def test_batch_load_processor_skips_invalid_rows_and_logs_validation_error(self):
        source_id = self._bootstrap_sqlserver_source()
        job = self.client.post(
            "/v1/etl/jobs",
            json={
                "sourceId": source_id,
                "domainCode": "dao_tao",
                "syncMode": "manual",
                "targetTable": "hoc_vien",
                "jobConfig": {
                    "primaryKeyColumn": "ma_hv",
                    "fieldMappings": {"ma_hv": "id"},
                    "targetKeyColumns": ["id"],
                    "requiredFields": ["id", "ho_ten"],
                },
                "status": "active",
            },
        )
        self.assertEqual(job.status_code, 200)
        job_id = job.json()["jobId"]

        run = self.client.post(
            f"/v1/etl/jobs/{job_id}/runs",
            json={"triggerType": "manual", "triggeredBy": "admin"},
        )
        self.assertEqual(run.status_code, 200)
        run_id = run.json()["runId"]

        store = main.app.state.store
        source = asyncio.run(store.get_source(source_id))
        job_payload = asyncio.run(store.get_job(job_id))
        run_payload = asyncio.run(store.get_run(run_id))

        processor = BatchLoadProcessor(
            postgres_writer=FakePostgresTargetWriter(),
            mongo_writer=FakeMongoTargetWriter(),
        )
        summary = asyncio.run(
            processor.process(
                job_payload,
                run_payload,
                source,
                {
                    "schemaName": "dbo",
                    "tableName": "hoc_vien",
                    "rows": [
                        {"ma_hv": "HV001", "ho_ten": "Nguyen Van A"},
                        {"ma_hv": "HV002", "ho_ten": ""},
                    ],
                },
                store,
            )
        )

        self.assertEqual(summary["recordOut"], 1)
        self.assertEqual(summary["validationErrors"], 1)
        self.assertEqual(summary["skippedRows"], 1)

        detail = self.client.get(f"/v1/etl/runs/{run_id}")
        self.assertEqual(detail.status_code, 200)
        payload = detail.json()
        self.assertEqual(len(payload["errors"]), 1)
        self.assertEqual(payload["errors"][0]["stage"], "validate")
        self.assertEqual(len(payload["lineage"]), 2)
        statuses = sorted(item["status"] for item in payload["lineage"])
        self.assertEqual(statuses, ["applied", "skipped"])


if __name__ == "__main__":
    unittest.main()
