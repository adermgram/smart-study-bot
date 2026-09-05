import re

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Pack paragraphs greedily into ~chunk_size-character chunks, carrying the tail
    of each chunk into the next as overlap so a concept split across the boundary
    still has surrounding context on both sides. Oversized paragraphs get hard-split."""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        return []

    chunks: list[str] = []
    current = ""

    for paragraph in paragraphs:
        candidate = f"{current}\n\n{paragraph}" if current else paragraph

        if len(candidate) <= chunk_size:
            current = candidate
            continue

        if current:
            chunks.append(current)
            current = current[-overlap:] if overlap else ""

        while len(paragraph) > chunk_size:
            chunks.append(paragraph[:chunk_size])
            paragraph = paragraph[chunk_size - overlap :]

        current = f"{current}\n\n{paragraph}" if current else paragraph

    if current:
        chunks.append(current)

    return chunks
