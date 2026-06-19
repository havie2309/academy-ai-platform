"""Run guarded SQL pipeline and format answer for chat."""

from __future__ import annotations

import time

from app.generate import LlmError
from app.sql_audit import log_sql_audit
from app.sql_execute import execute_sql
from app.sql_format import build_answer
from app.sql_generate import generate_sql
from app.sql_guardrail import SqlGuardrailError, apply_guardrail
from app.sql_resolve import resolve_scope_user
from app.sql_roles import is_staff_role, is_student_role, normalized_roles
from app.sql_scope import SqlScopeError, apply_scope
from app.sql_templates import (
    is_gpa_query,
    is_self_query,
    try_template_sql,
)


class SqlPipelineError(RuntimeError):
    def __init__(self, message: str, *, status: str = "error"):
        super().__init__(message)
        self.status = status


async def run_sql_query(question: str, user: dict) -> dict:
    started = time.perf_counter()
    generated_sql: str | None = None
    guarded_sql: str | None = None
    scoped_user = await resolve_scope_user(user)

    async def audit(
        status: str,
        *,
        deny_reason: str | None = None,
        row_count: int | None = None,
    ) -> None:
        latency_ms = int((time.perf_counter() - started) * 1000)
        await log_sql_audit(
            user=user,
            question=question,
            generated_sql=generated_sql,
            guarded_sql=guarded_sql,
            status=status,
            deny_reason=deny_reason,
            row_count=row_count,
            latency_ms=latency_ms,
        )

    try:
        template_sql = await try_template_sql(question, scoped_user)
        if template_sql:
            generated_sql = template_sql
            guarded_sql = apply_scope(template_sql, scoped_user)
        else:
            roles = normalized_roles(scoped_user.get("roles"))
            if not roles & {"ADMIN", "BGD", "P2", "HOC_VIEN", "GIANG_VIEN"}:
                raise SqlScopeError("Tài khoản không có quyền truy vấn SQL.")
            if is_gpa_query(question) and is_self_query(question):
                if is_staff_role(scoped_user.get("roles")):
                    raise SqlPipelineError(
                        "Tài khoản quản trị/cán bộ không có hồ sơ học viên. "
                        'Hãy hỏi cụ thể, ví dụ: "GPA của học viên 666106".',
                        status="deny",
                    )
                if is_student_role(scoped_user.get("roles")):
                    raise SqlPipelineError(
                        "Tài khoản của bạn chưa được liên kết với hồ sơ học viên. "
                        'Hãy hỏi: "GPA của học viên 666106" hoặc đăng nhập bằng mã học viên.',
                        status="deny",
                    )
            generated_sql = await generate_sql(question)
            guarded_sql = apply_guardrail(generated_sql)
            guarded_sql = apply_scope(guarded_sql, scoped_user)

        columns, rows = await execute_sql(guarded_sql)
        answer = build_answer(question, columns, rows)
        await audit("allow", row_count=len(rows))
        return {
            "answer": answer,
            "route": "sql",
            "row_count": len(rows),
        }
    except SqlGuardrailError as exc:
        await audit("deny", deny_reason=str(exc))
        raise SqlPipelineError(
            f"Truy vấn bị chặn bởi guardrail: {exc}",
            status="deny",
        ) from exc
    except SqlScopeError as exc:
        await audit("deny", deny_reason=str(exc))
        raise SqlPipelineError(str(exc), status="deny") from exc
    except LlmError as exc:
        await audit("error", deny_reason=str(exc))
        raise SqlPipelineError(str(exc), status="error") from exc
    except SqlPipelineError as exc:
        await audit(exc.status, deny_reason=str(exc))
        raise
    except Exception as exc:
        await audit("error", deny_reason=str(exc))
        raise SqlPipelineError(
            f"Không thể thực thi truy vấn: {exc}",
            status="error",
        ) from exc
