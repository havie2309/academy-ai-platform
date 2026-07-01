import sys
import unittest
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app  # noqa: F401,E402
from ai_clients import (  # noqa: E402
    ChatCompletionTarget,
    ResilienceOptions,
    create_chat_completion,
    create_embeddings,
    get_circuit_state,
    reset_circuit_breakers,
)


class _FakeResponse:
    def __init__(self, url: str, payload: dict, status_code: int = 200):
        self._payload = payload
        self._request = httpx.Request("POST", url)
        self._response = httpx.Response(status_code, request=self._request, json=payload)

    @property
    def status_code(self) -> int:
        return self._response.status_code

    @property
    def text(self) -> str:
        return self._response.text

    def raise_for_status(self) -> None:
        self._response.raise_for_status()

    def json(self) -> dict:
        return self._payload


class _ScriptedClient:
    def __init__(self, scripts: dict[str, list[object]]):
        self.scripts = {key: list(value) for key, value in scripts.items()}
        self.calls: list[str] = []

    async def post(self, url: str, **_kwargs):
        self.calls.append(url)
        queue = self.scripts.get(url)
        if not queue:
            raise AssertionError(f"Unexpected call to {url}")
        item = queue.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


def _http_error(url: str, status_code: int) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", url)
    response = httpx.Response(status_code, request=request, json={"detail": "upstream"})
    return httpx.HTTPStatusError(
        f"{status_code} upstream error",
        request=request,
        response=response,
    )


class AIClientsResilienceTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        reset_circuit_breakers()

    async def test_create_embeddings_retries_transient_failure(self):
        primary_url = "http://primary:8001/v1/embeddings"
        client = _ScriptedClient(
            {
                primary_url: [
                    httpx.ReadTimeout("temporary timeout"),
                    _FakeResponse(primary_url, {"data": [{"embedding": [1.0, 2.0]}]}),
                ]
            }
        )

        vectors = await create_embeddings(
            base_url="http://primary:8001",
            inputs=["hello"],
            client=client,
            resilience_options=ResilienceOptions(max_attempts=2, backoff_ms=0),
        )

        self.assertEqual(client.calls, [primary_url, primary_url])
        self.assertEqual(vectors, [[1.0, 2.0]])

    async def test_create_embeddings_falls_back_to_secondary_target(self):
        primary_url = "http://primary:8001/v1/embeddings"
        fallback_url = "http://fallback:8001/v1/embeddings"
        client = _ScriptedClient(
            {
                primary_url: [_http_error(primary_url, 503)],
                fallback_url: [
                    _FakeResponse(fallback_url, {"data": [{"embedding": [9.0]}]})
                ],
            }
        )

        vectors = await create_embeddings(
            base_url="http://primary:8001",
            fallback_base_urls=["http://fallback:8001"],
            inputs=["hello"],
            client=client,
            resilience_options=ResilienceOptions(max_attempts=1, backoff_ms=0),
        )

        self.assertEqual(client.calls, [primary_url, fallback_url])
        self.assertEqual(vectors, [[9.0]])

    async def test_circuit_breaker_skips_primary_after_threshold_reached(self):
        primary_url = "http://primary:8001/v1/embeddings"
        fallback_url = "http://fallback:8001/v1/embeddings"
        options = ResilienceOptions(
            max_attempts=1,
            backoff_ms=0,
            circuit_failure_threshold=1,
            circuit_timeout_seconds=60,
            circuit_half_open_max_requests=1,
        )
        first_client = _ScriptedClient(
            {
                primary_url: [_http_error(primary_url, 503)],
                fallback_url: [
                    _FakeResponse(fallback_url, {"data": [{"embedding": [3.0]}]})
                ],
            }
        )

        vectors = await create_embeddings(
            base_url="http://primary:8001",
            fallback_base_urls=["http://fallback:8001"],
            inputs=["hello"],
            client=first_client,
            resilience_options=options,
        )

        self.assertEqual(vectors, [[3.0]])
        self.assertEqual(get_circuit_state(f"embedding:{primary_url}"), "OPEN")

        second_client = _ScriptedClient(
            {
                fallback_url: [
                    _FakeResponse(fallback_url, {"data": [{"embedding": [4.0]}]})
                ]
            }
        )

        vectors = await create_embeddings(
            base_url="http://primary:8001",
            fallback_base_urls=["http://fallback:8001"],
            inputs=["hello-again"],
            client=second_client,
            resilience_options=options,
        )

        self.assertEqual(second_client.calls, [fallback_url])
        self.assertEqual(vectors, [[4.0]])

    async def test_create_chat_completion_uses_fallback_target(self):
        primary = ChatCompletionTarget(
            url="http://primary:11434/v1/chat/completions",
            model="qwen2.5:3b",
            headers={"Content-Type": "application/json"},
        )
        fallback = ChatCompletionTarget(
            url="http://fallback:11434/v1/chat/completions",
            model="qwen2.5:3b",
            headers={"Content-Type": "application/json"},
        )
        client = _ScriptedClient(
            {
                primary.url: [_http_error(primary.url, 503)],
                fallback.url: [
                    _FakeResponse(
                        fallback.url,
                        {"choices": [{"message": {"content": "fallback ok"}}]},
                    )
                ],
            }
        )

        payload = await create_chat_completion(
            primary,
            [{"role": "user", "content": "hello"}],
            client=client,
            fallback_targets=[fallback],
            resilience_options=ResilienceOptions(max_attempts=1, backoff_ms=0),
        )

        self.assertEqual(client.calls, [primary.url, fallback.url])
        self.assertEqual(
            payload["choices"][0]["message"]["content"],
            "fallback ok",
        )


if __name__ == "__main__":
    unittest.main()
