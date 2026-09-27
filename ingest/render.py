"""Render pages to PNG and extract the PDF text layer with fonts, colours and boxes."""
from __future__ import annotations

import re
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image

from ingest.models import DocInfo, Page, Span

RENDER_DPI = 150
MAX_IMAGE_SIDE = 2200
MIN_TEXT_CHARS = 25  # below this a PDF page is treated as a scan
MIN_FIGURE_COVERAGE = 0.12  # images covering this much of a digital page get a vision description

LATIN1_JUNK = re.compile(r"[\u00A0-\u00FF]")


def text_layer_broken(text: str) -> bool:
    """PDFs in Indian scripts (Tamil, Hindi, Telugu, Kannada, Malayalam, Bengali) often have a glyph-to-Unicode
    map that extracts as garbage: Latin-1 junk inside words, or vowel signs with no consonant before them."""
    import unicodedata
    from app.language import is_indic
    indic = sum(1 for ch in text if is_indic(ch))
    if indic < 10:
        return False
    orphans = 0
    prev = " "
    for ch in text:
        if is_indic(ch) and unicodedata.category(ch)[0] == "M" and (prev.isspace() or not is_indic(prev)):
            orphans += 1
        prev = ch
    return (len(LATIN1_JUNK.findall(text)) + orphans) / indic > 0.01


def _norm(bbox, width: float, height: float) -> list[float]:
    x0, y0, x1, y1 = bbox
    return [round(x0 / width, 4), round(y0 / height, 4), round(x1 / width, 4), round(y1 / height, 4)]


def _rgb(color_int: int) -> tuple[int, int, int]:
    return ((color_int >> 16) & 255, (color_int >> 8) & 255, color_int & 255)


def render_pages(doc: DocInfo, pages_dir: Path) -> list[tuple[Page, list[list[Span]]]]:
    """Returns each page plus its text-layer spans grouped by PDF block (empty for scans)."""
    out_dir = pages_dir / doc.doc_id
    out_dir.mkdir(parents=True, exist_ok=True)

    if doc.kind == "image":
        img = Image.open(doc.path)
        img = img.convert("RGB")
        img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
        target = out_dir / "1.png"
        img.save(target)
        return [(Page(doc.doc_id, 1, target, "image"), [])]

    results = []
    with fitz.open(doc.path) as pdf:
        for i, page in enumerate(pdf, start=1):
            target = out_dir / f"{i}.png"
            page.get_pixmap(dpi=RENDER_DPI).save(target)
            w, h = page.rect.width, page.rect.height
            blocks: list[list[Span]] = []
            line_no = 0
            for block in page.get_text("dict")["blocks"]:
                if block.get("type") != 0:
                    continue
                spans = []
                for line in block["lines"]:
                    line_no += 1
                    for s in line["spans"]:
                        if s["text"].strip():
                            spans.append(Span(text=s["text"], bbox=_norm(s["bbox"], w, h), size=s["size"], color=_rgb(s["color"]), line=line_no))
                if spans:
                    blocks.append(spans)
            layer = "\n".join(s.text for b in blocks for s in b)
            p = Page(doc.doc_id, i, target, "digital")
            if len(layer.strip()) < MIN_TEXT_CHARS:
                p.source_type, p.reason = "scan", "no text layer"
            elif text_layer_broken(layer):
                p.source_type, p.reason = "scan", "broken text layer (Indic glyph mapping)"
            else:
                figures = [r for r in (fitz.Rect(f["bbox"]) for f in page.get_image_info()) if r.width > 20]
                area = sum(abs(r & page.rect) for r in figures)
                if figures and area / abs(page.rect) >= MIN_FIGURE_COVERAGE:
                    p.figure_bbox = _norm((min(f[0] for f in figures), min(f[1] for f in figures),
                                           max(f[2] for f in figures), max(f[3] for f in figures)), w, h)
            results.append((p, blocks if p.source_type == "digital" else []))
    return results
