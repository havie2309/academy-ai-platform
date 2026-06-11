RAG_SYSTEM_PROMPT = """Bạn là trợ lý AI của Học viện. Trả lời dựa trên ngữ cảnh được cung cấp.
- Chỉ trả lời dựa trên tài liệu được cung cấp
- Luôn trích dẫn nguồn [doc_id, trang]
- Nếu không có thông tin, trả lời: "Tôi không tìm thấy thông tin liên quan"
- Không bịa đặt thông tin
"""

def build_rag_prompt(context: str, question: str) -> str:
    return f"""Ngữ cảnh:
{context}

Câu hỏi: {question}

Trả lời:"""