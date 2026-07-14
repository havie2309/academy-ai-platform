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
    print_summary,
    summarize_results,
)
from app.retrieval import RetrievalResult

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


class RagEvalTests(unittest.IsolatedAsyncioTestCase):
    async def test_fixture_cases_pass_chat_eval(self):
        payload = load_eval_cases(CASES_PATH)
        results: list[dict] = []
        total_cases = 0

        for group_name, case in iter_eval_cases(payload):
            total_cases += 1
            with self.subTest(group=group_name, case=case["name"]):
                async def _fake_retrieve(_query: str, _user: dict, scope_doc_ids: list[str] | None = None):
                    return RetrievalResult(citations=case.get("retrieved", []))

                async def _fake_complete(_history: list[dict], _citations: list[dict]):
                    llm_result = case.get("llm_result", {})
                    return (
                        llm_result.get("answer", ""),
                        llm_result.get("used_chunk_ids", []),
                        llm_result.get("reference_chunk_ids", []),
                    )

                async def _fake_maybe_refuse(_query: str, _user: dict | None = None) -> dict | None:
                    return None

                async def _fake_check_clarity(_query: str) -> dict | None:
                    return None

                body = rag_main.ChatRequest(
                    query=case["question"],
                    messages=[rag_main.ChatMessage(role="user", content=case["question"])],
                    user=rag_main.RetrieveUser(**case["user"]),
                )

                with (
                    patch.object(rag_main, "retrieve_citations", new=_fake_retrieve),
                    patch.object(rag_main, "complete_chat_structured", new=_fake_complete),
                    patch.object(rag_main, "maybe_refuse_query", new=_fake_maybe_refuse),
                    patch.object(rag_main, "check_query_clarity", new=_fake_check_clarity),
                ):
                    response = await rag_main.chat(body, _request())

                result = evaluate_response(
                    response,
                    case["expected"],
                    case_name=case["name"],
                    category=case.get("category", group_name),
                )
                results.append(result)
                if not result["passed"]:
                    print(f"\nFAILED: {format_result_failure(result)}")
                self.assertTrue(result["passed"], format_result_failure(result))

        summary = summarize_results(results)
        self.assertEqual(summary["total"], total_cases)
        self.assertEqual(summary["passed"], total_cases)

        # Print detailed metrics summary
        print_summary(summary)


if __name__ == "__main__":
    unittest.main()
