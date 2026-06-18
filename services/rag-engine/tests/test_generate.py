import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

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


if __name__ == "__main__":
    test_parse_structured_output_supports_reference_chunk_ids()
    test_parse_structured_output_cleans_retry_answer_text()
    test_parse_structured_output_hides_leaked_context_lines()
    print("ok")
