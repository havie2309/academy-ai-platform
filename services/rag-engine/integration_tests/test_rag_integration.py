#!/usr/bin/env python3
"""
Integration test for RAG engine against live services.
Requires local services (MongoDB, Milvus, Ollama) to be running.

Run:
    python -m unittest discover -s integration_tests -p "test_rag_integration.py" -v

For retrieval-only tests (skip_llm=true), uses /v1/retrieve (fast, no LLM).
For full tests, uses /v1/chat (includes LLM generation).
"""

import sys
import unittest
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import requests
from app.rag_eval import evaluate_response, load_eval_cases

RAG_CHAT_URL = "http://localhost:8000/v1/chat"
RAG_RETRIEVE_URL = "http://localhost:8000/v1/retrieve"
INTEGRATION_CASES_PATH = Path(__file__).resolve().parents[3] / "eval" / "integration_rag_cases.json"


class RagIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Check if services are alive
        try:
            r = requests.get("http://localhost:8000/health", timeout=2)
            if r.status_code != 200:
                raise Exception("RAG engine not ready")
        except Exception:
            print("\n[SKIP] RAG engine not running. Skipping integration tests.")
            print("Run 'rag_cli.py' or start services manually first.")
            raise unittest.SkipTest("RAG engine not available")

    def test_all_integration_cases(self):
        """Run all integration cases from eval/integration_rag_cases.json."""
        payload = load_eval_cases(INTEGRATION_CASES_PATH)
        integration_cases = payload.get("integration_cases", [])
        if not integration_cases:
            self.skipTest("No integration cases found in eval/integration_rag_cases.json")

        passed = 0
        total = 0
        failed_results = []

        for case in integration_cases:
            skip_llm = case.get("skip_llm", False)
            # Handle nested cases (multi-user scenarios)
            sub_cases = case.get("cases")
            if sub_cases:
                for sub in sub_cases:
                    total += 1
                    result = self._run_single_case(
                        question=case["question"],
                        user=sub["user"],
                        expected=sub["expected"],
                        doc_ids=case.get("docIds"),
                        skip_llm=skip_llm,
                        case_name=f"{case['name']} - {sub['user'].get('userId')}",
                        category=case.get("category", "integration"),
                    )
                    if result["passed"]:
                        passed += 1
                    else:
                        failed_results.append(result)
            else:
                total += 1
                result = self._run_single_case(
                    question=case["question"],
                    user=case["user"],
                    expected=case["expected"],
                    doc_ids=case.get("docIds"),
                    skip_llm=skip_llm,
                    case_name=case["name"],
                    category=case.get("category", "integration"),
                )
                if result["passed"]:
                    passed += 1
                else:
                    failed_results.append(result)

        print(f"\n[Integration] Passed: {passed}/{total}")
        if failed_results:
            for fail in failed_results:
                print(f"\n  FAIL: {fail.get('name')}")
                for k, v in fail.items():
                    if k not in ("passed", "name"):
                        print(f"    {k}: {v}")
        self.assertEqual(passed, total, f"Integration cases failed: {[r['name'] for r in failed_results]}")

    def _run_single_case(self, *, question, user, expected, doc_ids, skip_llm, case_name, category):
        """Execute one request (either retrieval-only or full chat) and validate."""
        # If skip_llm is True, use /v1/retrieve (fast, no LLM)
        if skip_llm:
            return self._run_retrieval_only(question, user, expected, doc_ids, case_name, category)
        else:
            return self._run_chat(question, user, expected, doc_ids, case_name, category)

    def _run_retrieval_only(self, question, user, expected, doc_ids, case_name, category):
        """Call /v1/retrieve and validate citations against expected ACL."""
        req = {
            "query": question,
            "user": user,
        }
        if doc_ids:
            req["docIds"] = doc_ids

        try:
            resp = requests.post(RAG_RETRIEVE_URL, json=req, timeout=30)
            if resp.status_code != 200:
                return {
                    "name": case_name,
                    "category": category,
                    "passed": False,
                    "error": f"HTTP {resp.status_code}: {resp.text[:200]}",
                }
            data = resp.json()
            citations = data.get("citations", [])

            # Validate against expected ACL
            acceptable = set(expected.get("acceptable_doc_ids", []))
            forbidden = expected.get("forbidden_doc_id")
            actual_docs = {c.get("doc_id") for c in citations}

            missing = acceptable - actual_docs if acceptable else set()
            has_forbidden = forbidden in actual_docs if forbidden else False

            passed = (not missing) and (not has_forbidden)
            if passed:
                return {"name": case_name, "category": category, "passed": True}
            else:
                return {
                    "name": case_name,
                    "category": category,
                    "passed": False,
                    "missing_acceptable": sorted(missing),
                    "has_forbidden": has_forbidden,
                    "actual_docs": sorted(actual_docs),
                    "expected_acceptable": sorted(acceptable),
                    "expected_forbidden": forbidden,
                }
        except Exception as e:
            return {"name": case_name, "category": category, "passed": False, "error": str(e)}

    def _run_chat(self, question, user, expected, doc_ids, case_name, category):
        """Call /v1/chat and evaluate with the full LLM response."""
        req = {
            "query": question,
            "sessionId": "integration-test",
            "messages": [],
            "user": user,
        }
        if doc_ids:
            req["docIds"] = doc_ids

        try:
            resp = requests.post(RAG_CHAT_URL, json=req, timeout=300)
            if resp.status_code != 200:
                return {
                    "name": case_name,
                    "category": category,
                    "passed": False,
                    "error": f"HTTP {resp.status_code}: {resp.text[:200]}",
                }
            result = resp.json()
            eval_result = evaluate_response(
                result,
                expected,
                case_name=case_name,
                category=category,
            )
            return eval_result
        except Exception as e:
            return {"name": case_name, "category": category, "passed": False, "error": str(e)}
