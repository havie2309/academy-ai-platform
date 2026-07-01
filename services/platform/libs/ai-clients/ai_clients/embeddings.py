from __future__ import annotations

from collections.abc import Sequence

import httpx

from .resilience import (
    ResilienceOptions,
    ResilientTarget,
    execute_with_resilience,
    load_resilience_options,
    parse_csv_env,
)
from .urls import build_service_url


def _resolve_embedding_urls(
    base_url: str | None,
    *,
    fallback_base_urls: Sequence[str] | None,
    default_base_url: str,
) -> list[str]:
    primary = build_service_url(
        base_url,
        "/v1/embeddings",
        default_base_url=default_base_url,
    )
    candidates = [primary]
    candidates.extend(
        build_service_url(
            item,
            "/v1/embeddings",
            default_base_url=default_base_url,
        )
        for item in (fallback_base_urls or parse_csv_env("EMBEDDING_FALLBACK_BASE_URLS"))
    )

    seen: set[str] = set()
    urls: list[str] = []
    for item in candidates:
        if item in seen:
            continue
        seen.add(item)
        urls.append(item)
    return urls


async def create_embeddings(
    *,
    base_url: str | None,
    inputs: str | Sequence[str],
    timeout: float = 60.0,
    client: httpx.AsyncClient | None = None,
    fallback_base_urls: Sequence[str] | None = None,
    resilience_options: ResilienceOptions | None = None,
    default_base_url: str = "http://localhost:8001",
) -> list[list[float]]:
    request_input = [inputs] if isinstance(inputs, str) else list(inputs)
    targets = [
        ResilientTarget(
            key=f"embedding:{url}",
            label=url,
            value=url,
        )
        for url in _resolve_embedding_urls(
            base_url,
            fallback_base_urls=fallback_base_urls,
            default_base_url=default_base_url,
        )
    ]
    options = resilience_options or load_resilience_options(
        "EMBEDDING",
        default_max_attempts=3,
        default_backoff_ms=400,
        legacy_max_attempts_env="EMBEDDING_MAX_RETRIES",
        legacy_backoff_env="EMBEDDING_RETRY_BACKOFF_MS",
    )

    async def _send(url: str) -> list[list[float]]:
        async def _post(request_client: httpx.AsyncClient) -> list[list[float]]:
            response = await request_client.post(url, json={"input": request_input})
            response.raise_for_status()
            data = response.json().get("data") or []
            return [item["embedding"] for item in data]

        if client is not None:
            return await _post(client)

        async with httpx.AsyncClient(timeout=timeout) as request_client:
            return await _post(request_client)

    return await execute_with_resilience(
        service_name="embedding",
        targets=targets,
        operation=_send,
        options=options,
    )
