def chunk_text(text: str, max_size: int = 1000, overlap_ratio: float = 0.1) -> list[str]:
    cleaned = text.replace("\r\n", "\n").strip()
    if not cleaned:
        return []

    overlap = max(0, int(max_size * overlap_ratio))
    chunks: list[str] = []
    start = 0
    length = len(cleaned)

    while start < length:
        end = min(start + max_size, length)
        piece = cleaned[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= length:
            break
        start = max(0, end - overlap)

    return chunks
