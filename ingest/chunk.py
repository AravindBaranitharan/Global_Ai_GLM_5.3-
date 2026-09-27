"""Chunking with page, bbox, doc_id, lang and acl_groups metadata."""
from __future__ import annotations

import re

from ingest.models import Block, Chunk, DocInfo, Page

MAX_CHARS = 900
HARD_MAX_CHARS = 1500


def detect_lang(text: str) -> str:
    from app.language import detect
    return detect(text)


def split_paragraphs(text: str) -> list[str]:
    """Blank-line paragraphs; oversize paragraphs are split on line breaks."""
    out = []
    for para in re.split(r"\n\s*\n", text.strip()):
        para = para.strip()
        if not para:
            continue
        if len(para) <= HARD_MAX_CHARS:
            out.append(para)
            continue
        buf = ""
        for line in para.splitlines():
            if buf and len(buf) + len(line) > MAX_CHARS:
                out.append(buf)
                buf = ""
            buf = f"{buf}\n{line}" if buf else line
        if buf:
            out.append(buf)
    return out


def _group(blocks: list[Block]) -> list[list[Block]]:
    """Greedily merge consecutive clean blocks up to MAX_CHARS. Quarantined blocks stay alone."""
    groups: list[list[Block]] = []
    current: list[Block] = []
    size = 0
    for b in blocks:
        if b.quarantined:
            if current:
                groups.append(current)
                current, size = [], 0
            groups.append([b])
            continue
        if current and size + len(b.text) > MAX_CHARS:
            groups.append(current)
            current, size = [], 0
        current.append(b)
        size += len(b.text) + 1
    if current:
        groups.append(current)
    return groups


def chunk_page(doc: DocInfo, page: Page, start_index: int = 0) -> list[Chunk]:
    chunks = []
    for i, group in enumerate(_group(page.blocks), start=start_index):
        text = "\n".join(b.text for b in group)
        chunks.append(Chunk(
            chunk_id=f"{doc.doc_id}:p{page.number}:c{i}",
            doc_id=doc.doc_id,
            title=doc.title,
            rel_path=doc.rel_path,
            page=page.number,
            text=text,
            bboxes=[b.bbox for b in group if b.bbox],
            lang=detect_lang(text),
            acl_groups=doc.acl_groups,
            source_type=page.source_type,
            quarantined=any(b.quarantined for b in group),
            flags=sorted({f for b in group for f in b.flags}),
            lines=[l for b in group for l in b.lines],
            domain=doc.domain,
        ))
    return chunks
