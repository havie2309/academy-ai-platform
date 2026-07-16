"""Central LLM target resolution for all tasks.

All resolvers delegate to a single helper to avoid duplication.
"""

from ai_clients import ChatCompletionTarget, resolve_chat_target
from app.config import (
    LLM_PROVIDER,
    LLM_BASE_URL,
    LLM_MODEL,
    LLM_FALLBACK_PROVIDER,
    LLM_FALLBACK_BASE_URL,
    LLM_FALLBACK_MODEL,
    OPENAI_API_KEY,
    OPENAI_MODEL,
    SQL_LLM_PROVIDER,
    SQL_LLM_BASE_URL,
    SQL_LLM_MODEL,
    SQL_OPENAI_MODEL,
    SUMMARY_LLM_PROVIDER,
    SUMMARY_LLM_BASE_URL,
    SUMMARY_LLM_MODEL,
    EXERCISE_LLM_PROVIDER,
    EXERCISE_LLM_BASE_URL,
    EXERCISE_LLM_MODEL,
)


class TargetResolutionError(RuntimeError):
    pass


# ──────────────────────────────────────────────────────────────────────────────
# Single shared resolver
# ──────────────────────────────────────────────────────────────────────────────

def _resolve_task_target(
    provider: str,
    base_url: str,
    model: str,
    openai_model: str,
) -> ChatCompletionTarget:
    """
    Shared resolver logic for any task.
    All task‑specific resolvers delegate to this helper.
    """
    try:
        return resolve_chat_target(
            provider=provider,
            base_url=base_url,
            model=model,
            openai_api_key=OPENAI_API_KEY,
            openai_model=openai_model,
        )
    except ValueError as exc:
        raise TargetResolutionError(str(exc)) from exc


# ──────────────────────────────────────────────────────────────────────────────
# Public resolvers – each is a one‑liner
# ──────────────────────────────────────────────────────────────────────────────

def resolve_default_target() -> ChatCompletionTarget:
    return _resolve_task_target(
        provider=LLM_PROVIDER,
        base_url=LLM_BASE_URL,
        model=LLM_MODEL,
        openai_model=OPENAI_MODEL,
    )


def resolve_sql_target() -> ChatCompletionTarget:
    return _resolve_task_target(
        provider=SQL_LLM_PROVIDER or LLM_PROVIDER,
        base_url=SQL_LLM_BASE_URL or LLM_BASE_URL,
        model=SQL_LLM_MODEL or LLM_MODEL,
        openai_model=SQL_OPENAI_MODEL or OPENAI_MODEL,
    )


def resolve_summary_target() -> ChatCompletionTarget:
    return _resolve_task_target(
        provider=SUMMARY_LLM_PROVIDER or LLM_PROVIDER,
        base_url=SUMMARY_LLM_BASE_URL or LLM_BASE_URL,
        model=SUMMARY_LLM_MODEL or LLM_MODEL,
        openai_model=OPENAI_MODEL,  # summary doesn't have its own openai_model yet
    )


def resolve_exercise_target() -> ChatCompletionTarget:
    return _resolve_task_target(
        provider=EXERCISE_LLM_PROVIDER or LLM_PROVIDER,
        base_url=EXERCISE_LLM_BASE_URL or LLM_BASE_URL,
        model=EXERCISE_LLM_MODEL or LLM_MODEL,
        openai_model=OPENAI_MODEL,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Fallback logic (also shared)
# ──────────────────────────────────────────────────────────────────────────────

def fallback_targets(primary_target: ChatCompletionTarget) -> list[ChatCompletionTarget]:
    """
    Build fallback targets for a given primary target using the global fallback config.
    Returns an empty list if no fallback is configured or it duplicates the primary.
    """
    has_fallback = bool(
        LLM_FALLBACK_PROVIDER or LLM_FALLBACK_BASE_URL or LLM_FALLBACK_MODEL
    )
    if not has_fallback:
        return []

    provider = LLM_FALLBACK_PROVIDER or ("ollama" if LLM_FALLBACK_BASE_URL else "openai")
    model = LLM_FALLBACK_MODEL or (OPENAI_MODEL if provider == "openai" else LLM_MODEL)
    try:
        fallback = resolve_chat_target(
            provider=provider,
            base_url=LLM_FALLBACK_BASE_URL,
            model=model,
            openai_api_key=OPENAI_API_KEY,
            openai_model=model,
        )
    except ValueError as exc:
        raise TargetResolutionError(str(exc)) from exc

    # Avoid duplicate target
    if (fallback.url, fallback.model) == (primary_target.url, primary_target.model):
        return []
    return [fallback]
