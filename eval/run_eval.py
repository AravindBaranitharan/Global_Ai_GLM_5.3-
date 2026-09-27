"""Score retrieval and answers against eval/golden.yaml.

    python -m eval.run_eval --retrieval-only        # no LLM calls, free
    python -m eval.run_eval --label cloud           # full run through LLM_BASE_URL

Phase 4 bar: >=85% retrieval hit@6, 100% refusals correct, 0 invalid citations.
"""
from __future__ import annotations

import argparse
import json
import re
import time
from datetime import datetime
from pathlib import Path

import yaml
from qdrant_client import QdrantClient

from app.answer import AnswerService, User
from app.audit.log import AuditLog
from app.config import ROOT, load_settings
from app.llm.client import LLMClient
from app.retrieval.models import Embedder, Reranker
from app.retrieval.search import Retriever
from app.retrieval.store import VectorStore

HIT_K = 6


def norm(s: str) -> str:
    return re.sub(r"[\s,₹]", "", s).lower()


def load_users(path: Path) -> dict[str, User]:
    data = yaml.safe_load(path.read_text())
    return {u["id"]: User(u["id"], u["name"], u.get("title", ""), list(u["groups"])) for u in data["users"]}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--retrieval-only", action="store_true")
    ap.add_argument("--label", default=None, help="name for the results file, e.g. cloud or h200")
    ap.add_argument("--only", help="comma-separated question ids")
    args = ap.parse_args()

    s = load_settings()
    golden = yaml.safe_load((ROOT / "eval/golden.yaml").read_text())["questions"]
    if args.only:
        wanted = set(args.only.split(","))
        golden = [q for q in golden if q["id"] in wanted]
    users = load_users(s.users_file)

    store = VectorStore(QdrantClient(url=s.qdrant_url), s.collection)
    retriever = Retriever(Embedder(s.embed_model_path), Reranker(s.rerank_model_path, fp16=s.rerank_fp16), store,
                          top_k=s.retrieve_top_k, rerank_k=max(HIT_K, s.rerank_top_k), min_score=s.rerank_min_score)
    out_dir = ROOT / "eval/results"
    out_dir.mkdir(parents=True, exist_ok=True)
    service = None if args.retrieval_only else AnswerService(
        retriever, LLMClient(s.llm), AuditLog(out_dir / "eval_audit.sqlite"), mode_label=s.mode_label)

    rows = []
    for q in golden:
        user = users[q["user"]]
        t0 = time.perf_counter()
        dom = {"domain": q["domain"]} if q.get("domain") else {}
        hits = retriever.search(q["question"], user.groups, include_quarantined=False, **dom)
        top_docs = [h.payload["doc_id"] for h in hits[:HIT_K]]
        row = {"id": q["id"], "category": q["category"], "user": user.id, "question": q["question"],
               "top_docs": top_docs, "retrieval_ms": int((time.perf_counter() - t0) * 1000)}
        if q.get("expect_doc"):
            row["hit"] = q["expect_doc"] in top_docs
            if q.get("expect_page"):
                row["page_hit"] = any(h.payload["doc_id"] == q["expect_doc"] and h.payload["page"] == q["expect_page"] for h in hits[:HIT_K])
        if q.get("forbidden_doc"):
            row["acl_ok"] = q["forbidden_doc"] not in [h.payload["doc_id"] for h in hits]

        if service:
            ans = service.ask(user, q["question"], defence=True, agent=q.get("agent", "expert"), **dom)
            row.update(answer=ans.answer, refused=ans.refused, invalid_citations=ans.invalid_citations,
                       cited_docs=sorted({c["doc_id"] for c in ans.citations}), llm_ms=ans.llm_latency_ms,
                       error=ans.error, flags=ans.flags)
            if q.get("expect_refusal"):
                row["refusal_ok"] = ans.refused
            else:
                row["refusal_ok"] = not ans.refused
                row["citation_ok"] = q["expect_doc"] in row["cited_docs"]
                row["contains_ok"] = all(norm(x) in norm(ans.answer) for x in q.get("answer_contains", []))
                if q.get("must_not_contain"):
                    row["contains_ok"] = row["contains_ok"] and not any(x.lower() in ans.answer.lower() for x in q["must_not_contain"])
        rows.append(row)
        status = "ok " if row.get("hit", row.get("acl_ok", True)) else "MISS"
        print(f"{status} {q['id']:5} {top_docs[:3]} {('| ' + row['answer'][:80].replace(chr(10), ' ')) if service else ''}")

    def rate(key, subset=None):
        vals = [r[key] for r in (subset or rows) if key in r]
        return (sum(vals), len(vals))

    summary = {
        "label": args.label or ("retrieval-only" if args.retrieval_only else s.mode_label),
        "endpoint": None if args.retrieval_only else s.llm.base_url,
        "model": None if args.retrieval_only else s.llm.model,
        "reasoning_effort": s.llm.reasoning_effort,
        "retrieval_hit@6": rate("hit"),
        "page_hit@6": rate("page_hit"),
        "acl_never_retrieved": rate("acl_ok"),
        "by_category": {c: rate("hit", [r for r in rows if r["category"] == c])
                        for c in sorted({r["category"] for r in rows})},
    }
    if service:
        summary.update({
            "refusal_correct": rate("refusal_ok", [r for r in rows if r["category"] == "refusal"]),
            "answered_when_expected": rate("refusal_ok", [r for r in rows if r["category"] != "refusal"]),
            "citation_accuracy": rate("citation_ok"),
            "answer_contains": rate("contains_ok"),
            "invalid_citations_total": sum(len(r.get("invalid_citations") or []) for r in rows),
            "errors": sum(1 for r in rows if r.get("error")),
            "median_llm_ms": sorted(r["llm_ms"] for r in rows if r.get("llm_ms"))[len([r for r in rows if r.get("llm_ms")]) // 2] if any(r.get("llm_ms") for r in rows) else None,
        })

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    path = out_dir / f"{stamp}-{summary['label'].replace(' ', '_')}.json"
    path.write_text(json.dumps({"summary": summary, "rows": rows}, ensure_ascii=False, indent=1))

    print("\n=== Summary ===")
    for k, v in summary.items():
        if isinstance(v, tuple):
            print(f"{k:26} {v[0]}/{v[1]} ({100 * v[0] / v[1]:.0f}%)" if v[1] else f"{k:26} n/a")
        elif k == "by_category":
            for c, (a, b) in v.items():
                print(f"  hit@6 {c:20} {a}/{b}" if b else f"  hit@6 {c:20} n/a")
        else:
            print(f"{k:26} {v}")
    print(f"\nSaved {path}")


if __name__ == "__main__":
    main()
