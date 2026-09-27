"""One command ingests the whole corpus:  python -m ingest [--reset] [--only hr/leave_policy.pdf]"""
from __future__ import annotations

import argparse
import json
import sys
import time

from qdrant_client import QdrantClient

from app.config import load_settings
from app.llm.client import LLMClient
from app.retrieval.models import Embedder
from app.retrieval.store import VectorStore
from ingest.loader import walk_corpus
from ingest.ocr_boxes import tesseract_available
from ingest.pipeline import Ingestor
from ingest.vision import VisionTranscriber


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="drop the collection and registry first")
    ap.add_argument("--only", help="ingest a single corpus-relative path")
    ap.add_argument("--cache-only", action="store_true", help="never call the vision endpoint; fail pages not in the cache")
    args = ap.parse_args()

    s = load_settings()
    docs = walk_corpus(s.corpus_dir)
    if args.only:
        docs = [d for d in docs if d.rel_path == args.only]
    if not docs:
        print("No documents found.")
        return 1

    if not tesseract_available():
        print("! Tesseract not installed: scans get page-level citations without highlight boxes.")

    store = VectorStore(QdrantClient(url=s.qdrant_url), s.collection)
    store.ensure(reset=args.reset)
    ingestor = Ingestor(s, Embedder(s.embed_model_path), store,
                        VisionTranscriber(LLMClient(s.vision), s.data_dir / "cache" / "vision", cache_only=args.cache_only))
    if args.reset:
        ingestor.registry.reset()

    errors, quarantine = 0, []
    start = time.time()
    for doc in docs:
        print(f"\n== {doc.rel_path}  groups={doc.acl_groups}")
        for ev in ingestor.ingest_doc(doc):
            step = ev["step"]
            if step == "error":
                errors += 1
                print(f"   ERROR p{ev.get('page')}: {ev['message']}")
            elif step == "warning":
                print(f"   WARN {ev['message']}")
            elif step == "vision_done":
                print(f"   p{ev['page']} vision {'(cached)' if ev['cached'] else ''} {ev['chars']} chars")
            elif step == "quarantine":
                quarantine.append({"doc": doc.rel_path, **{k: v for k, v in ev.items() if k != 'step'}})
                print(f"   QUARANTINED p{ev['page']} {ev['flags']}: {ev['text'][:90]!r}")
            elif step == "indexed":
                print(f"   indexed {ev['chunks']} chunks ({ev['quarantined']} quarantined)")

    report = s.data_dir / "quarantine_report.json"
    report.write_text(json.dumps(quarantine, ensure_ascii=False, indent=1))
    print(f"\nDone in {time.time() - start:.0f}s: {len(docs)} docs, {store.count()} chunks in Qdrant, "
          f"{len(quarantine)} quarantined spans, {errors} errors.\nQuarantine report: {report}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
