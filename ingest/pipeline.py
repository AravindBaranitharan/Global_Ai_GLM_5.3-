"""Loader -> render -> (text layer | vision + OCR boxes) -> sanitise -> chunk -> embed -> Qdrant.

`ingest_doc` yields progress events so the UI can show live ingest step by step.
"""
from __future__ import annotations

import json
import threading
from collections.abc import Iterator
from pathlib import Path

from PIL import Image

from app.config import Settings
from ingest import chunk as chunker
from ingest import ocr_boxes
from ingest.models import Chunk, DocInfo
from ingest.render import render_pages
from ingest.sanitize import sanitize_pdf_blocks, sanitize_text_blocks

_registry_lock = threading.Lock()


def figure_description(transcription: str) -> str:
    """The DESCRIPTION: section of a vision transcription (chart/diagram content)."""
    idx = transcription.find("DESCRIPTION:")
    return transcription[idx:].strip() if idx >= 0 else ""


class Registry:
    """data/docs.json: what was ingested, page counts, quarantined spans (for the UI and report)."""

    def __init__(self, path: Path):
        self.path = path

    def load(self) -> dict:
        return json.loads(self.path.read_text()) if self.path.exists() else {}

    def put(self, doc_id: str, entry: dict) -> None:
        with _registry_lock:
            data = self.load()
            data[doc_id] = entry
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.path.write_text(json.dumps(data, ensure_ascii=False, indent=1))

    def remove(self, doc_id: str) -> None:
        with _registry_lock:
            data = self.load()
            data.pop(doc_id, None)
            self.path.write_text(json.dumps(data, ensure_ascii=False, indent=1))

    def reset(self) -> None:
        if self.path.exists():
            self.path.unlink()


class Ingestor:
    def __init__(self, settings: Settings, embedder, store, transcriber=None):
        self.s = settings
        self.embedder = embedder
        self.store = store
        self.transcriber = transcriber
        self.pages_dir = settings.data_dir / "pages"
        self.registry = Registry(settings.data_dir / "docs.json")

    def ingest_doc(self, doc: DocInfo) -> Iterator[dict]:
        yield {"step": "start", "doc_id": doc.doc_id, "title": doc.title, "acl_groups": doc.acl_groups}
        if not doc.acl_groups:
            yield {"step": "warning", "message": f"{doc.rel_path} has no access groups in acl.yaml; nobody will see it"}

        chunks: list[Chunk] = []
        quarantined: list[dict] = []
        source_types: set[str] = set()
        rendered = render_pages(doc, self.pages_dir)
        yield {"step": "rendered", "pages": len(rendered)}

        for page, pdf_blocks in rendered:
            source_types.add(page.source_type)
            if page.source_type == "digital":
                page.blocks = sanitize_pdf_blocks(pdf_blocks, Image.open(page.image_path))
                yield {"step": "text_layer", "page": page.number, "blocks": len(page.blocks)}
                if page.figure_bbox and self.transcriber is not None:
                    yield {"step": "vision_start", "page": page.number, "reason": "chart or diagram on page"}
                    try:
                        text, cached = self.transcriber.transcribe(page.image_path)
                    except Exception as e:
                        yield {"step": "error", "page": page.number, "message": f"figure description failed: {e}"}
                    else:
                        desc = figure_description(text)
                        yield {"step": "vision_done", "page": page.number, "cached": cached, "chars": len(desc), "preview": desc[:400]}
                        if desc:
                            page.blocks += [b for b in sanitize_text_blocks([desc])]
                            page.blocks[-1].bbox = page.figure_bbox
            else:
                if self.transcriber is None:
                    yield {"step": "error", "page": page.number, "message": "page needs vision transcription but no vision client is configured"}
                    continue
                yield {"step": "vision_start", "page": page.number, "reason": page.reason}
                try:
                    text, cached = self.transcriber.transcribe(page.image_path)
                except Exception as e:  # keep going; one bad page must not stop the corpus
                    yield {"step": "error", "page": page.number, "message": f"vision failed: {e}"}
                    continue
                page.transcription = text
                (page.image_path.with_suffix(".txt")).write_text(text)
                yield {"step": "vision_done", "page": page.number, "cached": cached, "chars": len(text), "preview": text[:400]}
                page.blocks = sanitize_text_blocks(chunker.split_paragraphs(text))

            page_chunks = chunker.chunk_page(doc, page)
            if page.source_type != "digital":
                from app.language import ocr_langs
                lines = ocr_boxes.ocr_lines(page.image_path, ocr_langs(page.transcription))
                for c in page_chunks:
                    matched = ocr_boxes.align_lines(c.text, lines)
                    c.bboxes = [l.bbox for l in matched]
                    c.lines = [{"b": l.bbox, "t": l.text} for l in matched]
            for c in page_chunks:
                if c.quarantined:
                    quarantined.append({"chunk_id": c.chunk_id, "page": c.page, "text": c.text, "bboxes": c.bboxes, "flags": c.flags})
            chunks.extend(page_chunks)
            yield {"step": "chunked", "page": page.number, "chunks": len(page_chunks), "quarantined": sum(c.quarantined for c in page_chunks)}

        for q in quarantined:
            yield {"step": "quarantine", **q}

        yield {"step": "embedding", "chunks": len(chunks)}
        vectors = self.embedder.encode([f"{c.title}\n{c.text}" for c in chunks]) if chunks else []
        self.store.delete_doc(doc.doc_id)
        self.store.upsert([c.payload() for c in chunks], vectors)

        self.registry.put(doc.doc_id, {
            "title": doc.title,
            "rel_path": doc.rel_path,
            "pages": len(rendered),
            "source_types": sorted(source_types),
            "acl_groups": doc.acl_groups,
            "domain": doc.domain,
            "chunks": len(chunks),
            "quarantined": quarantined,
        })
        yield {"step": "indexed", "doc_id": doc.doc_id, "chunks": len(chunks), "quarantined": len(quarantined)}
