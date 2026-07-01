from __future__ import annotations

import json
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass

import httpx

from .resilience import (
    ResilienceOptions,
    ResilientTarget,
    execute_with_resilience,
    iterate_with_resilience,
    load_resilience_options,
)
from .urls import build_service_url


@dataclass(frozen=True)
class ChatCompletionTarget:
    url: str
    model: str
    headers: dict[str, str]


def resolve_chat_target(
    *,
    provider: str | None,
    base_url: str | None,
    model: str,
    openai_api_key: str | None = None,
    openai_model: str | None = None,
    default_base_url: str = "http://localhost:11434",
) -> ChatCompletionTarget:
    resolved_provider = (provider or "").strip().lower()
    if not resolved_provider:
        resolved_provider = "ollama" if (base_url or "").strip() else "openai"

    if resolved_provider == "openai":
        api_key = (openai_api_key or "").strip()
        if not api_key:
            raise ValueError("Missing OPENAI_API_KEY for OpenAI chat completions.")
        return ChatCompletionTarget(
            url="https://api.openai.com/v1/chat/completions",
            model=(openai_model or model).strip(),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
        )

    if resolved_provider != "ollama":
        raise ValueError(f"Unsupported LLM provider: {resolved_provider}")

    return ChatCompletionTarget(
        url=build_service_url(
            base_url,
            "/v1/chat/completions",
            default_base_url=default_base_url,
        ),
        model=model.strip(),
        headers={"Content-Type": "application/json"},
    )


def extract_message_content(payload: dict) -> str | None:
    return (payload.get("choices") or [{}])[0].get("message", {}).get("content")


def _dedupe_chat_targets(
    primary: ChatCompletionTarget,
    fallback_targets: Sequence[ChatCompletionTarget] | None,
) -> list[ResilientTarget[ChatCompletionTarget]]:
    ordered_targets = [primary, *(fallback_targets or [])]
    seen: set[str] = set()
    targets: list[ResilientTarget[ChatCompletionTarget]] = []
    for target in ordered_targets:
        key = f"llm:{target.url}|{target.model}"
        if key in seen:
            continue
        seen.add(key)
        targets.append(
            ResilientTarget(
                key=key,
                label=f"{target.url} [{target.model}]",
                value=target,
            )
        )
    return targets


async def create_chat_completion(
    target: ChatCompletionTarget,
    messages: Sequence[dict[str, str]],
    *,
    temperature: float | None = None,
    timeout: float = 120.0,
    client: httpx.AsyncClient | None = None,
    fallback_targets: Sequence[ChatCompletionTarget] | None = None,
    resilience_options: ResilienceOptions | None = None,
    extra_payload: dict | None = None,
) -> dict:
    targets = _dedupe_chat_targets(target, fallback_targets)
    options = resilience_options or load_resilience_options(
        "LLM",
        default_max_attempts=2,
        default_backoff_ms=300,
    )

    async def _send(active_target: ChatCompletionTarget) -> dict:
        payload: dict = {
            "model": active_target.model,
            "messages": list(messages),
        }
        if temperature is not None:
            payload["temperature"] = temperature
        if extra_payload:
            payload.update(extra_payload)

        async def _post(request_client: httpx.AsyncClient) -> dict:
            response = await request_client.post(
                active_target.url,
                headers=active_target.headers,
                json=payload,
            )
            response.raise_for_status()
            return response.json()

        if client is not None:
            return await _post(client)

        async with httpx.AsyncClient(timeout=timeout) as request_client:
            return await _post(request_client)

    return await execute_with_resilience(
        service_name="llm",
        targets=targets,
        operation=_send,
        options=options,
    )


async def stream_chat_completion(
    target: ChatCompletionTarget,
    messages: Sequence[dict[str, str]],
    *,
    timeout: float = 120.0,
    fallback_targets: Sequence[ChatCompletionTarget] | None = None,
    resilience_options: ResilienceOptions | None = None,
    extra_payload: dict | None = None,
) -> AsyncIterator[str]:
    targets = _dedupe_chat_targets(target, fallback_targets)
    options = resilience_options or load_resilience_options(
        "LLM",
        default_max_attempts=2,
        default_backoff_ms=300,
    )

    async def _stream(active_target: ChatCompletionTarget) -> AsyncIterator[str]:
        payload: dict = {
            "model": active_target.model,
            "messages": list(messages),
            "stream": True,
        }
        if extra_payload:
            payload.update(extra_payload)

        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST",
                active_target.url,
                headers=active_target.headers,
                json=payload,
            ) as response:
                if response.status_code >= 400:
                    await response.aread()
                    response.raise_for_status()
                async for line in response.aiter_lines():
                    line = line.strip()
                    if not line.startswith("data:"):
                        continue
                    payload_str = line[5:].strip()
                    if payload_str == "[DONE]":
                        break
                    try:
                        obj = json.loads(payload_str)
                    except json.JSONDecodeError:
                        continue
                    delta = (obj.get("choices") or [{}])[0].get("delta", {}).get("content")
                    if delta:
                        yield delta

    async for delta in iterate_with_resilience(
        service_name="llm",
        targets=targets,
        operation=_stream,
        options=options,
    ):
        yield delta
