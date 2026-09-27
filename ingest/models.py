"""Data shapes shared across the ingestion pipeline.

All bounding boxes are normalised to the page: [x0, y0, x1, y1] in 0..1,
so the UI can overlay them on a page image of any size.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class DocInfo:
    doc_id: str
    path: Path          # absolute path of the source file
    rel_path: str       # path relative to the corpus root, e.g. "hr/leave_policy.pdf"
    title: str
    kind: str           # "pdf" | "image"
    acl_groups: list[str]
    domain: str = "general"   # uploads/<domain>/...; searched by that domain's expert


@dataclass
class Span:
    text: str
    bbox: list[float]
    size: float = 0.0
    color: tuple[int, int, int] = (0, 0, 0)
    flags: list[str] = field(default_factory=list)
    line: int = 0       # line index within the page, for per-line highlight boxes


QUARANTINE_FLAGS = {"hidden_colour", "tiny_font", "off_page", "injection_pattern"}


@dataclass
class Block:
    """A paragraph-ish unit of text with its location on the page."""
    text: str
    bbox: list[float] | None
    flags: list[str] = field(default_factory=list)
    lines: list[dict] = field(default_factory=list)   # [{"b": bbox, "t": text}] for precise highlights

    @property
    def quarantined(self) -> bool:
        # "instruction_like" is informational: visible text that quotes injection phrases, as security
        # documents do. Hidden text, and instruction text read from images, is quarantined.
        return any(f in QUARANTINE_FLAGS for f in self.flags)


@dataclass
class Page:
    doc_id: str
    number: int         # 1-based
    image_path: Path
    source_type: str    # "digital" | "scan" | "image"
    blocks: list[Block] = field(default_factory=list)
    transcription: str = ""
    reason: str = ""                          # why this page went to vision
    figure_bbox: list[float] | None = None    # digital page with a large chart/diagram image


@dataclass
class Chunk:
    chunk_id: str
    doc_id: str
    title: str
    rel_path: str
    page: int
    text: str
    bboxes: list[list[float]]
    lang: str
    acl_groups: list[str]
    source_type: str
    quarantined: bool = False
    flags: list[str] = field(default_factory=list)
    lines: list[dict] = field(default_factory=list)
    domain: str = "general"

    def payload(self) -> dict:
        return {
            "chunk_id": self.chunk_id,
            "doc_id": self.doc_id,
            "title": self.title,
            "rel_path": self.rel_path,
            "page": self.page,
            "text": self.text,
            "bboxes": self.bboxes,
            "lang": self.lang,
            "acl_groups": self.acl_groups,
            "source_type": self.source_type,
            "quarantined": self.quarantined,
            "flags": self.flags,
            "lines": self.lines,
            "domain": self.domain,
        }
