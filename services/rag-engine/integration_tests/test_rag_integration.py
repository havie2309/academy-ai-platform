#!/usr/bin/env python3
"""
Integration test for RAG authority selection.
Requires local services (MongoDB, Milvus, Ollama) to be running.
Run: python -m unittest discover -s tests -p "test_rag_integration.py" -v
"""

import os
import sys
import unittest
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import requests
from app.rag_eval import evaluate_response, load_eval_cases, iter_eval_cases

RAG_CHAT_URL = "http://localhost:8000/v1/chat"
CASES_PATH = Path(__file__).resolve().parents[3] / "eval" / "rag_cases.json"


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

    def test_authority_conflict_live(self):
        """Test that the live RAG engine picks the internal doc over adversarial."""
        payload = load_eval_cases(CASES_PATH)
        conflict_cases = []
        for group, case in iter_eval_cases(payload):
            if case.get("name", "").startswith("conflict_"):
                conflict_cases.append(case)

        if not conflict_cases:
            self.skipTest("No authority conflict cases found in eval/rag_cases.json")

        passed = 0
        failed_results = []
        for case in conflict_cases:
            # Build request payload (same as rag_cli.py)
            req = {
                "query": case["question"],
                "sessionId": "integration-test",
                "messages": [],
                "user": {
                    "userId": "admin-1",
                    "username": "admin",
                    "roles": ["ADMIN"],
                    "department": "P2",
                    "maxSecurityLevel": 4,
                    "scopeMaHv": None,
                    "scopeMaGv": None,
                },
            }
            try:
                resp = requests.post(RAG_CHAT_URL, json=req, timeout=300)
                self.assertEqual(resp.status_code, 200, f"API failed for {case['name']}")
                result = resp.json()
                eval_result = evaluate_response(
                    result,
                    case["expected"],
                    case_name=case["name"],
                    category=case.get("category", "authority"),
                )
                if eval_result["passed"]:
                    passed += 1
                else:
                    failed_results.append(eval_result)
            except Exception as e:
                failed_results.append({'name': case["name"], 'error': e})

        total = len(conflict_cases)
        print(f"\n[Integration] Authority accuracy: {passed}/{total}")
        if failed_results:
            for fail in failed_results:
                print(f"\n  FAIL: {fail['name']}")
                for k, v in fail.items():
                    print(f"    {k}: {v}")
        self.assertEqual(passed, total, f"Authority cases failed: {[r['name'] for r in failed_results]}")
