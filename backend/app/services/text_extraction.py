import io

from docx import Document as DocxDocument
from fastapi import HTTPException, status
from pypdf import PdfReader


def extract_text(filename: str, content: bytes) -> str:
    suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if suffix == "pdf":
        reader = PdfReader(io.BytesIO(content))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)

    if suffix == "docx":
        doc = DocxDocument(io.BytesIO(content))
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())

    if suffix in ("txt", "md"):
        return content.decode("utf-8", errors="ignore")

    raise HTTPException(
        status.HTTP_400_BAD_REQUEST,
        f"Unsupported file type '.{suffix}'. Upload a PDF, DOCX, TXT, or MD file.",
    )
