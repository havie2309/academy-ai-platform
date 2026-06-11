BLACKLIST_KEYWORDS = []

SAFE_REFUSAL_MESSAGE = "Xin lỗi, tôi không thể trả lời câu hỏi này."

def is_blocked(text: str, blacklist: list[str] = BLACKLIST_KEYWORDS) -> bool:
    text_lower = text.lower()
    return any(keyword.lower() in text_lower for keyword in blacklist)

def safe_refusal() -> str:
    return SAFE_REFUSAL_MESSAGE