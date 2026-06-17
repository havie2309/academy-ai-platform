import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.chunker import chunk_document, chunk_text  # noqa: E402


SAMPLE_REGULATION = """
Chương I. QUY ĐỊNH CHUNG
Điều 1. Phạm vi điều chỉnh
Quy chế này quy định về khảo thí.

Chương II. ĐIỀU KIỆN DỰ THI
Điều 5. Điều kiện về điểm
Sinh viên có GPA từ 4.0 trở lên được dự thi.

Điều 6. Điều kiện về chuyên cần
Sinh viên vắng quá 20% tổng số tiết không được dự thi cuối kỳ.
Mục 1. Cách tính số tiết vắng
Số tiết vắng được tính trên tổng số tiết của học phần.
""".strip()


def test_structural_split_keeps_dieu_separate():
    chunks = chunk_document(SAMPLE_REGULATION, max_size=500, overlap_ratio=0.1)
    paths = [c.section_path for c in chunks]
    assert any("Điều 5" in p for p in paths)
    assert any("Điều 6" in p for p in paths)
    texts = " ".join(c.text for c in chunks)
    assert "GPA" in texts
    assert "20%" in texts


def test_recursive_split_when_section_too_small_limit():
    long_body = "Điều 7. " + ("Nội dung dài. " * 80)
    chunks = chunk_document(long_body, max_size=120, overlap_ratio=0.1)
    assert len(chunks) > 1
    assert all(c.section_path.startswith("Điều 7") for c in chunks)


def test_plain_text_fallback_to_char_chunks():
    plain = "A" * 250
    chunks = chunk_document(plain, max_size=100, overlap_ratio=0.1)
    assert len(chunks) >= 2
    assert all(c.section_path == "" for c in chunks)


def test_chunk_text_wrapper():
    assert chunk_text("hello world", max_size=100) == ["hello world"]


if __name__ == "__main__":
    test_structural_split_keeps_dieu_separate()
    test_recursive_split_when_section_too_small_limit()
    test_plain_text_fallback_to_char_chunks()
    test_chunk_text_wrapper()
    print("ok")
