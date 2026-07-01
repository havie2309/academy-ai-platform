import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.sql_generate as sql_generate  # noqa: E402


class SqlGenerateTests(unittest.TestCase):
    def test_build_sql_messages_include_schema_and_few_shot(self):
        messages = sql_generate.build_sql_messages("GPA của học viên 666106 là bao nhiêu?")

        self.assertEqual(messages[0]["role"], "system")
        self.assertIn("sql_curated.v_hoc_vien_gpa", messages[0]["content"])
        self.assertIn("Ví dụ tham chiếu", messages[0]["content"])
        self.assertEqual(messages[-1]["content"], "GPA của học viên 666106 là bao nhiêu?")

    def test_extract_sql_handles_multiline_fenced_output(self):
        raw = """
```sql
SELECT ma_hv,
       gpa_he4
FROM sql_curated.v_hoc_vien_gpa
WHERE ma_hv = '666106'
LIMIT 1;
```
""".strip()
        sql = sql_generate._extract_sql(raw)

        self.assertTrue(sql.startswith("SELECT ma_hv,"))
        self.assertIn("FROM sql_curated.v_hoc_vien_gpa", sql)
        self.assertNotIn("\n", sql)

    def test_sql_llm_target_prefers_dedicated_model_config(self):
        with patch.object(sql_generate, "SQL_LLM_PROVIDER", "ollama"), patch.object(
            sql_generate, "SQL_LLM_BASE_URL", "http://sql-host:11434"
        ), patch.object(sql_generate, "SQL_LLM_MODEL", "qwen2.5:3b"):
            url, model, headers = sql_generate._sql_llm_target()

        self.assertEqual(url, "http://sql-host:11434/v1/chat/completions")
        self.assertEqual(model, "qwen2.5:3b")
        self.assertEqual(headers["Content-Type"], "application/json")

    def test_sql_llm_target_does_not_duplicate_v1_suffix(self):
        with patch.object(sql_generate, "SQL_LLM_PROVIDER", "ollama"), patch.object(
            sql_generate, "SQL_LLM_BASE_URL", "http://sql-host:11434/v1"
        ), patch.object(sql_generate, "SQL_LLM_MODEL", "qwen2.5:3b"):
            url, model, headers = sql_generate._sql_llm_target()

        self.assertEqual(url, "http://sql-host:11434/v1/chat/completions")
        self.assertEqual(model, "qwen2.5:3b")
        self.assertEqual(headers["Content-Type"], "application/json")


if __name__ == "__main__":
    unittest.main()
