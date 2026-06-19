import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.sql_guardrail import SqlGuardrailError, apply_guardrail  # noqa: E402
from app.sql_scope import apply_scope  # noqa: E402
from app.sql_templates import try_template_sql  # noqa: E402

CASES_PATH = Path(__file__).resolve().parents[3] / "eval" / "sql_cases.json"


def _load_cases() -> dict:
    return json.loads(CASES_PATH.read_text(encoding="utf-8"))


class SqlEvalTemplateTests(unittest.IsolatedAsyncioTestCase):
    async def test_template_cases_match_expected_sql(self):
        cases = _load_cases()["template_cases"]
        for case in cases:
            with self.subTest(case=case["name"]):
                sql = await try_template_sql(case["question"], case["user"])
                self.assertIsNotNone(sql)
                for expected in case["contains"]:
                    self.assertIn(expected, sql)


class SqlEvalSecurityTests(unittest.TestCase):
    def test_scope_cases_apply_expected_filters(self):
        cases = _load_cases()["scope_cases"]
        for case in cases:
            with self.subTest(case=case["name"]):
                scoped = apply_scope(case["sql"], case["user"])
                for expected in case["contains"]:
                    self.assertIn(expected, scoped)

    def test_guardrail_cases_reject_unsafe_sql(self):
        cases = _load_cases()["guardrail_cases"]
        for case in cases:
            with self.subTest(case=case["name"]):
                with self.assertRaises(SqlGuardrailError) as ctx:
                    apply_guardrail(case["sql"])
                self.assertIn(case["error_contains"], str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
