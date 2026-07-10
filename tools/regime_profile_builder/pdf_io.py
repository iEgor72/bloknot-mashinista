from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any


class PdfBuilderError(RuntimeError):
    pass


def _stroke_tuple(value: Any) -> tuple[float, ...] | None:
    if not isinstance(value, (tuple, list)):
        return None
    try:
        return tuple(float(item) for item in value)
    except (TypeError, ValueError):
        return None


def _word_record(word: dict) -> dict:
    return {
        "text": str(word.get("text", "")),
        "x0": float(word.get("x0", 0)),
        "x1": float(word.get("x1", 0)),
        "top": float(word.get("top", 0)),
        "bottom": float(word.get("bottom", 0)),
    }


def _char_record(char: dict, order: int) -> dict:
    return {
        "text": str(char.get("text", "")),
        # Keep the PDF content-stream order.  Rotated numeric labels are often
        # rendered bottom-to-top, so geometric sorting reverses values such as
        # ``0,6`` into ``6,0``.  Source order retains the semantic text.
        "order": int(order),
        "x0": float(char.get("x0", 0)),
        "x1": float(char.get("x1", 0)),
        "top": float(char.get("top", 0)),
        "bottom": float(char.get("bottom", 0)),
        "upright": bool(char.get("upright", True)),
        "size": float(char.get("size", 0) or 0),
    }


def _raw_line_record(line: dict) -> dict:
    return {
        "x0": float(line.get("x0", 0)),
        "x1": float(line.get("x1", 0)),
        "top": float(line.get("top", 0)),
        "bottom": float(line.get("bottom", 0)),
        "stroke": _stroke_tuple(line.get("stroking_color")),
        "linewidth": float(line.get("linewidth") or 0),
    }


def _append_oriented_vectors(page, objects: list[dict], output: list[dict]) -> None:
    for obj in objects:
        points = obj.get("pts") or []
        if len(points) < 2:
            output.append(
                {
                    "x0": float(obj.get("x0", 0)),
                    "y0": float(obj.get("y0", 0)),
                    "x1": float(obj.get("x1", 0)),
                    "y1": float(obj.get("y1", 0)),
                    "stroke": _stroke_tuple(obj.get("stroking_color")),
                    "linewidth": float(obj.get("linewidth") or 0),
                }
            )
            continue
        # pdfplumber pts/path use top-origin Y. Builder geometry uses the PDF
        # bottom-origin system so the oriented rise/fall is retained.
        for start, end in zip(points, points[1:]):
            output.append(
                {
                    "x0": float(start[0]),
                    "y0": float(page.height) - float(start[1]),
                    "x1": float(end[0]),
                    "y1": float(page.height) - float(end[1]),
                    "stroke": _stroke_tuple(obj.get("stroking_color")),
                    "linewidth": float(obj.get("linewidth") or 0),
                }
            )


def fingerprint_pdf(path: Path) -> dict:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return {
        "file_name": path.name,
        "sha256": digest.hexdigest(),
        "size_bytes": path.stat().st_size,
    }


def load_vector_pdf(path: Path) -> dict:
    try:
        import pdfplumber
    except ImportError as error:  # pragma: no cover - environment failure
        raise PdfBuilderError("pdfplumber is required for vector profile extraction") from error

    if not path.is_file():
        raise PdfBuilderError(f"PDF not found: {path}")

    pages: list[dict] = []
    try:
        with pdfplumber.open(path) as document:
            for page_number, page in enumerate(document.pages, start=1):
                vectors: list[dict] = []
                _append_oriented_vectors(page, list(page.lines), vectors)
                _append_oriented_vectors(page, list(page.curves), vectors)
                pages.append(
                    {
                        "page_number": page_number,
                        "width": float(page.width),
                        "height": float(page.height),
                        "words": [
                            _word_record(word)
                            for word in page.extract_words(
                                x_tolerance=1,
                                y_tolerance=3,
                                keep_blank_chars=False,
                            )
                        ],
                        "chars": [
                            _char_record(char, order)
                            for order, char in enumerate(page.chars)
                        ],
                        "vectors": vectors,
                        "lines": [_raw_line_record(line) for line in page.lines],
                    }
                )
    except Exception as error:
        raise PdfBuilderError(f"Cannot read vector PDF {path}: {error}") from error

    if not pages:
        raise PdfBuilderError(f"PDF contains no pages: {path}")
    if not any(page["vectors"] for page in pages):
        raise PdfBuilderError(
            "PDF contains no usable vector paths; raster/scan adapter is not implemented yet"
        )
    return {
        "path": str(path.resolve()),
        "fingerprint": fingerprint_pdf(path),
        "page_count": len(pages),
        "pages": pages,
    }
