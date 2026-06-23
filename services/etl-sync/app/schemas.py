from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class EtlSourceCreate(BaseModel):
    sourceId: str | None = None
    sourceSystem: str = Field(..., min_length=2, max_length=50)
    displayName: str = Field(..., min_length=2, max_length=255)
    sourceKind: Literal["sqlserver", "postgres", "mongodb", "http", "file", "mock"]
    connectionConfig: dict[str, Any] = Field(default_factory=dict)
    active: bool = True


class EtlJobCreate(BaseModel):
    jobId: str | None = None
    sourceId: str = Field(..., min_length=2, max_length=50)
    domainCode: str = Field(..., min_length=2, max_length=50)
    syncMode: Literal["batch", "event", "manual"]
    targetTable: str | None = Field(default=None, max_length=100)
    targetCollection: str | None = Field(default=None, max_length=100)
    scheduleCron: str | None = Field(default=None, max_length=100)
    jobConfig: dict[str, Any] = Field(default_factory=dict)
    status: Literal["draft", "active", "paused", "archived"] = "draft"
    createdBy: str | None = Field(default=None, max_length=20)


class EtlRunCreate(BaseModel):
    runId: str | None = None
    sourceRange: dict[str, Any] = Field(default_factory=dict)
    triggerType: Literal["manual", "schedule", "event", "replay", "system"] = "manual"
    triggeredBy: str | None = Field(default=None, max_length=20)


class EtlRunUpdate(BaseModel):
    status: Literal["queued", "running", "completed", "failed", "cancelled"]
    recordIn: int | None = Field(default=None, ge=0)
    recordOut: int | None = Field(default=None, ge=0)
    errorSummary: str | None = None
    sourceRange: dict[str, Any] | None = None


class EtlLineageCreate(BaseModel):
    sourceSystem: str = Field(..., min_length=2, max_length=50)
    sourceTable: str | None = Field(default=None, max_length=100)
    sourcePk: str | None = Field(default=None, max_length=255)
    targetTable: str | None = Field(default=None, max_length=100)
    targetPk: str | None = Field(default=None, max_length=255)
    targetCollection: str | None = Field(default=None, max_length=100)
    targetDocumentId: str | None = Field(default=None, max_length=100)
    operation: Literal["insert", "update", "upsert", "delete", "skip"] = "upsert"
    status: Literal["applied", "skipped", "failed"] = "applied"
    payloadHash: str | None = Field(default=None, max_length=64)
    note: str | None = None


class EtlErrorCreate(BaseModel):
    sourceSystem: str = Field(..., min_length=2, max_length=50)
    stage: Literal["extract", "transform", "load", "lineage", "validate", "system"]
    errorCode: str | None = Field(default=None, max_length=50)
    errorMessage: str = Field(..., min_length=1)
    detail: dict[str, Any] = Field(default_factory=dict)
    retryable: bool = False


class SqlServerReadRequest(BaseModel):
    schemaName: str = Field(default="dbo", min_length=1, max_length=100)
    tableName: str = Field(..., min_length=1, max_length=100)
    columns: list[str] = Field(default_factory=list)
    limit: int = Field(default=100, ge=1, le=1000)
    cursorColumn: str | None = Field(default=None, max_length=100)
    cursorValue: str | int | float | None = None
    orderBy: str | None = Field(default=None, max_length=100)
    descending: bool = False
