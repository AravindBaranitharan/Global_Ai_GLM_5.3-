"""Ingestion-time injection defence.

Quarantines text a human reader would not see (colour matches the background, tiny font,
off-page), whatever it says, and instruction-like text read from images by vision. Quarantined
chunks are excluded from retrieval while INJECTION_DEFENCE is on and shown in the UI.

Visible PDF text that merely contains instruction-like phrases is indexed and tagged
"instruction_like": security documents quote attack phrases all the time, and quarantining
them removed exactly the knowledge a GenAI-security knowledge base exists to hold. Spotlighting
in the prompt still stops the model from obeying such text.
"""
from __future__ import annotations

import re

from PIL import Image

from ingest.models import Block, Span

TINY_FONT_PT = 4.0
COLOUR_DISTANCE = 40  # RGB euclidean distance treated as "same as background"

INJECTION_PATTERNS = [
    r"\bignore\b.{0,30}\b(previous|prior|above|earlier|all)\b.{0,20}\b(instructions?|prompts?|rules|guidelines)",
    r"\bdisregard\b.{0,40}\b(instructions?|prompts?|rules|guidelines|context)",
    r"\byou are now\b",
    r"\bnew (system )?instructions?\b",
    r"\bsystem prompt\b",
    r"\b(ai|assistant|chatbot|model|llm)s?\b.{0,40}\b(must|should|shall|always)\b.{0,40}\b(recommend|tell|say|include|respond|reply|direct|mention|reveal)",
    r"\b(note|message)s? (to|for) (the )?(ai|assistant|chatbot|model|llm)s?\b",  # not "instructions to the model": common in real docs
    r"\bdo not (tell|mention|reveal|inform)\b.{0,20}\b(the )?user",
    r"\b(reveal|disclose|output|print)\b.{0,40}\b(system prompt|password|credentials|salary|confidential)",
    r"\bwhen (asked|answering|responding)\b.{0,60}\b(always|must|instead)\b",
    r"முந்தைய\s+(அறிவுறுத்தல்|வழிமுறை)",  # Tamil: "previous instructions"
]
_PATTERNS = [re.compile(p, re.IGNORECASE | re.DOTALL) for p in INJECTION_PATTERNS]


def injection_matches(text: str) -> list[str]:
    return [p.pattern for p in _PATTERNS if p.search(text)]


def _background_colour(img: Image.Image, bbox: list[float]) -> tuple[int, int, int] | None:
    w, h = img.size
    box = (int(bbox[0] * w), int(bbox[1] * h), int(bbox[2] * w) + 1, int(bbox[3] * h) + 1)
    if box[2] <= box[0] or box[3] <= box[1]:
        return None
    region = img.crop(box).convert("RGB").resize((24, 8))
    return max(region.getcolors(24 * 8), key=lambda c: c[0])[1]


def _distance(a, b) -> float:
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


def span_flags(span: Span, page_img: Image.Image) -> list[str]:
    flags = []
    x0, y0, x1, y1 = span.bbox
    if x1 <= 0 or y1 <= 0 or x0 >= 1 or y0 >= 1:
        flags.append("off_page")
        return flags
    if span.size and span.size < TINY_FONT_PT:
        flags.append("tiny_font")
    bg = _background_colour(page_img, span.bbox)
    if bg is not None and _distance(bg, span.color) < COLOUR_DISTANCE:
        flags.append("hidden_colour")
    return flags


def _union(bboxes: list[list[float]]) -> list[float]:
    return [min(b[0] for b in bboxes), min(b[1] for b in bboxes), max(b[2] for b in bboxes), max(b[3] for b in bboxes)]


def _lines(spans: list[Span]) -> list[dict]:
    by_line: dict[int, list[Span]] = {}
    for s in spans:
        by_line.setdefault(s.line, []).append(s)
    return [{"b": _union([s.bbox for s in ss]), "t": " ".join(s.text.strip() for s in ss)} for ss in by_line.values()]


def sanitize_pdf_blocks(blocks: list[list[Span]], page_img: Image.Image) -> list[Block]:
    """Split each PDF block into visible text and quarantined runs of hidden text."""
    out: list[Block] = []
    for spans in blocks:
        visible: list[Span] = []
        hidden: list[Span] = []
        for s in spans:
            s.flags = span_flags(s, page_img)
            (hidden if s.flags else visible).append(s)
        if visible:
            text = " ".join(s.text.strip() for s in visible)
            flags = ["instruction_like"] if injection_matches(text) else []
            out.append(Block(text=text, bbox=_union([s.bbox for s in visible]), flags=flags, lines=_lines(visible)))
        if hidden:
            text = " ".join(s.text.strip() for s in hidden)
            flags = sorted({f for s in hidden for f in s.flags})
            if injection_matches(text):
                flags.append("injection_pattern")
            out.append(Block(text=text, bbox=_union([s.bbox for s in hidden]), flags=flags, lines=_lines(hidden)))
    return out


def sanitize_text_blocks(paragraphs: list[str]) -> list[Block]:
    """Transcribed text has no colours or fonts; only the pattern check applies."""
    return [Block(text=p, bbox=None, flags=["injection_pattern"] if injection_matches(p) else []) for p in paragraphs]
