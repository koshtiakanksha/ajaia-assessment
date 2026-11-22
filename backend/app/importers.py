"""Convert uploaded files into editor-ready HTML.

Every importer returns HTML; the caller sanitizes it with the same allowlist
used for normal saves, so imported content is exactly as safe as typed content.
"""
import html
import io
import re
from pathlib import PurePath

import mammoth
import markdown

SUPPORTED_EXTENSIONS = (".txt", ".md", ".markdown", ".docx")
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB


class FileImportError(ValueError):
    """A user-facing problem with the uploaded file (bad type, empty, corrupt)."""


def file_extension(filename: str) -> str:
    return PurePath(filename).suffix.lower()


def title_from_filename(filename: str) -> str:
    stem = PurePath(filename).stem.strip()
    return stem[:200] or "Imported document"


def _decode_text(data: bytes) -> str:
    try:
        return data.decode("utf-8-sig")  # also strips a UTF-8 BOM if present
    except UnicodeDecodeError:
        # Common for files saved by older Windows editors; latin-1 never fails.
        return data.decode("cp1252", errors="replace")


def txt_to_html(text: str) -> str:
    """Blank lines separate paragraphs; single newlines become line breaks."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    paragraphs = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
    return "".join(
        "<p>" + "<br>".join(html.escape(line) for line in p.strip("\n").split("\n")) + "</p>"
        for p in paragraphs
    )


def md_to_html(text: str) -> str:
    return markdown.markdown(text, extensions=["sane_lists"])


def docx_to_html(data: bytes) -> str:
    if not data.startswith(b"PK"):  # .docx files are zip archives
        raise FileImportError("This file doesn't look like a valid .docx document.")
    try:
        # mammoth drops underline by default; the editor supports it, so keep it.
        result = mammoth.convert_to_html(io.BytesIO(data), style_map="u => u")
    except Exception as exc:  # mammoth raises various errors for corrupt files
        raise FileImportError("Couldn't read this .docx file. It may be corrupted.") from exc
    return result.value


def _downgrade_small_headings(html_text: str) -> str:
    # The editor supports H1-H3; keep deeper headings as H3 instead of losing them.
    return re.sub(r"<(/?)h[4-6]\b", r"<\1h3", html_text)


def convert_to_html(filename: str, data: bytes) -> str:
    ext = file_extension(filename)
    if ext not in SUPPORTED_EXTENSIONS:
        raise FileImportError(
            f"Unsupported file type '{ext or filename}'. Supported: .txt, .md, .docx"
        )
    if not data.strip():
        raise FileImportError("The file is empty.")

    if ext == ".docx":
        result = docx_to_html(data)
    elif ext in (".md", ".markdown"):
        result = md_to_html(_decode_text(data))
    else:
        result = txt_to_html(_decode_text(data))

    return _downgrade_small_headings(result)
