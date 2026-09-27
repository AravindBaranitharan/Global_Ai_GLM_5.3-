"""Walk the corpus, detect file types and resolve access groups from acl.yaml."""
from __future__ import annotations

import re
from pathlib import Path

import yaml

from ingest.models import DocInfo

PDF_EXT = {".pdf"}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"}


def doc_id_for(rel_path: str) -> str:
    stem = rel_path.rsplit(".", 1)[0]
    return re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")


def title_for(path: Path) -> str:
    return re.sub(r"[_\-]+", " ", path.stem).strip().title()


class ACL:
    """acl.yaml: folder defaults plus per-file overrides. Unlisted -> no access (fail closed)."""

    def __init__(self, data: dict):
        self.folders: dict[str, list[str]] = data.get("folders") or {}
        self.files: dict[str, list[str]] = data.get("files") or {}

    @classmethod
    def load(cls, path: Path) -> "ACL":
        return cls(yaml.safe_load(path.read_text()) if path.exists() else {})

    def groups_for(self, rel_path: str) -> list[str]:
        if rel_path in self.files:
            return list(self.files[rel_path])
        parts = rel_path.split("/")
        # Longest matching folder prefix wins.
        for i in range(len(parts) - 1, 0, -1):
            folder = "/".join(parts[:i])
            if folder in self.folders:
                return list(self.folders[folder])
        return []


def pdf_title(path: Path) -> str | None:
    """The title stored in a PDF's metadata, if it looks like a real title."""
    if path.suffix.lower() != ".pdf":
        return None
    try:
        import fitz
        with fitz.open(path) as doc:
            t = (doc.metadata or {}).get("title", "").strip()
    except Exception:
        return None
    return t if 3 <= len(t) <= 120 and not t.lower().endswith((".pdf", ".docx")) else None


def load_titles(corpus_dir: Path) -> dict[str, str]:
    meta = corpus_dir / "meta.yaml"
    return (yaml.safe_load(meta.read_text()) or {}).get("titles", {}) if meta.exists() else {}


def load_doc(path: Path, corpus_dir: Path, acl: ACL, titles: dict[str, str] | None = None) -> DocInfo | None:
    ext = path.suffix.lower()
    if ext in PDF_EXT:
        kind = "pdf"
    elif ext in IMAGE_EXT:
        kind = "image"
    else:
        return None
    rel = path.relative_to(corpus_dir).as_posix()
    parts = rel.split("/")
    domain = parts[1] if len(parts) > 2 and parts[0] == "uploads" else "general"
    return DocInfo(
        doc_id=doc_id_for(rel),
        path=path.resolve(),
        rel_path=rel,
        title=(titles or {}).get(rel) or pdf_title(path) or title_for(path),
        kind=kind,
        acl_groups=acl.groups_for(rel),
        domain=domain,
    )


def walk_corpus(corpus_dir: Path) -> list[DocInfo]:
    acl = ACL.load(corpus_dir / "acl.yaml")
    titles = load_titles(corpus_dir)
    docs = []
    for path in sorted(corpus_dir.rglob("*")):
        rel_parts = path.relative_to(corpus_dir).parts
        if not path.is_file() or any(p.startswith((".", "_")) for p in rel_parts):
            continue
        doc = load_doc(path, corpus_dir, acl, titles)
        if doc:
            docs.append(doc)
    return docs
