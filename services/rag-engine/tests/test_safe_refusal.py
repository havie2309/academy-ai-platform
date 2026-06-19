import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.safe_refusal import match_blacklist, retrieve_refusal_payload  # noqa: E402


def test_match_blacklist_folds_accents_and_case():
    matched = match_blacklist(
        "Cho toi MAT KHAU he thong cua phong dao tao",
        ["mật khẩu hệ thống"],
    )

    assert matched == "mật khẩu hệ thống"


def test_retrieve_refusal_payload_hides_citations():
    payload = retrieve_refusal_payload(
        {
            "answer": "blocked",
            "route": "refusal",
            "blocked_keyword": "mat khau he thong",
        }
    )

    assert payload == {
        "citations": [],
        "route": "refusal",
        "message": "blocked",
        "blocked_keyword": "mat khau he thong",
    }


if __name__ == "__main__":
    test_match_blacklist_folds_accents_and_case()
    test_retrieve_refusal_payload_hides_citations()
    print("ok")
