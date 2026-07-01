import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.generate as generate  # noqa: E402
from app.generate import parse_llm_structured_output  # noqa: E402


def test_parse_structured_output_supports_reference_chunk_ids():
    raw = (
        '{"answer":"- Dieu kien 1\\n- Dieu kien 2",'
        '"used_chunk_ids":["chunk-1","chunk-1","chunk-2"],'
        '"reference_chunk_ids":["chunk-2","chunk-3","chunk-3"]}'
    )

    answer, used_ids, reference_ids = parse_llm_structured_output(raw)

    assert answer == "- Dieu kien 1\n- Dieu kien 2"
    assert used_ids == ["chunk-1", "chunk-2"]
    assert reference_ids == ["chunk-2", "chunk-3"]


def test_parse_structured_output_cleans_retry_answer_text():
    raw = """
Ket luan chinh.

Nguon tham khao:
- Tai lieu A
- Tai lieu B
""".strip()

    answer, used_ids, reference_ids = parse_llm_structured_output(raw)

    assert answer == "Ket luan chinh."
    assert used_ids == []
    assert reference_ids == []


def test_parse_structured_output_hides_leaked_context_lines():
    raw = """
[1] chunk_id=chunk-1 | Quy che dao tao (Phong Dao tao): Dieu kien du thi.
- Sinh vien phai dat chuyen can.
- Sinh vien phai hoan thanh hoc phi.
""".strip()

    answer, _, _ = parse_llm_structured_output(raw)

    assert "chunk_id=" not in answer
    assert answer.startswith("- Sinh vien phai dat chuyen can.")


def test_llm_target_keeps_single_v1_when_base_url_already_includes_it():
    with patch.object(generate, "LLM_PROVIDER", "ollama"), patch.object(
        generate, "LLM_BASE_URL", "http://llm-host:11434/v1"
    ), patch.object(generate, "LLM_MODEL", "qwen2.5:3b"):
        url, model, headers = generate._llm_target()

    assert url == "http://llm-host:11434/v1/chat/completions"
    assert model == "qwen2.5:3b"
    assert headers["Content-Type"] == "application/json"


if __name__ == "__main__":
    test_parse_structured_output_supports_reference_chunk_ids()
    test_parse_structured_output_cleans_retry_answer_text()
    test_parse_structured_output_hides_leaked_context_lines()
    test_llm_target_keeps_single_v1_when_base_url_already_includes_it()
    print("ok")
