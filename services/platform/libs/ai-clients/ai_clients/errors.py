from __future__ import annotations

import httpx


class AIClientError(RuntimeError):
    def __init__(
        self,
        service_name: str,
        message: str,
        *,
        target_label: str | None = None,
        attempts: int = 1,
        status_code: int | None = None,
        retryable: bool = False,
        last_exception: Exception | None = None,
    ) -> None:
        super().__init__(message)
        self.service_name = service_name
        self.target_label = target_label
        self.attempts = attempts
        self.status_code = status_code
        self.retryable = retryable
        self.last_exception = last_exception

    @classmethod
    def from_exception(
        cls,
        service_name: str,
        target_label: str,
        attempt: int,
        exc: Exception,
        *,
        retryable: bool,
    ) -> "AIClientError":
        if isinstance(exc, AIClientError):
            return exc

        if isinstance(exc, httpx.HTTPStatusError):
            status_code = exc.response.status_code if exc.response is not None else None
            detail = ""
            if exc.response is not None:
                detail = exc.response.text[:200]
            message = f"{service_name} upstream returned HTTP {status_code} at {target_label}"
            if detail:
                message = f"{message}: {detail}"
            return cls(
                service_name,
                message,
                target_label=target_label,
                attempts=attempt,
                status_code=status_code,
                retryable=retryable,
                last_exception=exc,
            )

        if isinstance(exc, httpx.TimeoutException):
            message = f"{service_name} request timed out at {target_label}"
        elif isinstance(exc, httpx.NetworkError):
            message = f"{service_name} network error at {target_label}: {exc}"
        else:
            message = f"{service_name} request failed at {target_label}: {exc}"

        return cls(
            service_name,
            message,
            target_label=target_label,
            attempts=attempt,
            retryable=retryable,
            last_exception=exc,
        )


class CircuitOpenError(AIClientError):
    def __init__(
        self,
        service_name: str,
        target_label: str,
        *,
        timeout_seconds: int,
    ) -> None:
        super().__init__(
            service_name,
            f"{service_name} circuit open for {target_label} (cooldown {timeout_seconds}s)",
            target_label=target_label,
            retryable=True,
        )
