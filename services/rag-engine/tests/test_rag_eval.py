import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from starlette.requests import Request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main as rag_main  # noqa: E402
from app.rag_eval import (  # noqa: E402
    evaluate_response,
    format_result_failure,
    iter_eval_cases,
    load_eval_cases,
    summarize_results,
)

CASES_PATH = Path(__file__).resolve().parents[3] / "eval" / "rag_cases.json"


def _request() -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/v1/chat",
            "headers": [],
        }
    )


async def _run_chat_case(case: dict) -> dict:
    retrieved = case.get("retrieved", [])
    llm_result = case.get("llm_result", {})

    async def _fake_retrieve(_query: str, _user: dict):
        return retrieved

    async def _fake_complete(_history: list[dict], _citations: list[dict]):
        return (
            llm_result.get("answer", ""),
            llm_result.get("used_chunk_ids", []),
            llm_result.get("reference_chunk_ids", []),
        )

    body = rag_main.ChatRequest(
        query=case["question"],
        messages=[rag_main.ChatMessage(role="user", content=case["question"])],
        user=rag_main.RetrieveUser(**case["user"]),
    )

    with (
        patch.object(rag_main, "retrieve_citations", new=_fake_retrieve),
        patch.object(rag_main, "complete_chat_structured", new=_fake_complete),
    ):
        return await rag_main.chat(body, _request())


class RagEvalTests(unittest.IsolatedAsyncioTestCase):
    async def test_fixture_cases_pass_chat_eval(self):
        payload = load_eval_cases(CASES_PATH)
        results: list[dict] = []

        for group_name, case in iter_eval_cases(payload):
            with self.subTest(group=group_name, case=case["name"]):
                response = await _run_chat_case(case)
                result = evaluate_response(
                    response,
                    case["expected"],
                    case_name=case["name"],
                    category=case.get("category", group_name),
                )
                results.append(result)
                self.assertTrue(result["passed"], format_result_failure(result))

        summary = summarize_results(results)
        self.assertEqual(summary["total"], 5)
        self.assertEqual(summary["passed"], 5)
        self.assertEqual(summary["refusal_total"], 2)
        self.assertEqual(summary["refusal_passed"], 2)
        self.assertEqual(summary["by_category"]["citation"]["passed"], 2)
        self.assertEqual(summary["by_category"]["fallback"]["passed"], 1)
        self.assertEqual(summary["by_category"]["refusal"]["passed"], 2)


if __name__ == "__main__":
    unittest.main()
