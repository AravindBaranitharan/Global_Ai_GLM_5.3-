"""ACL filter -> hybrid search (top 30) -> rerank (top 6-8)."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Hit:
    payload: dict
    score: float

    @property
    def chunk_id(self) -> str:
        return self.payload["chunk_id"]


class Retriever:
    def __init__(self, embedder, reranker, store, *, top_k: int = 30, rerank_k: int = 7, min_score: float = 0.02):
        self.embedder = embedder
        self.reranker = reranker
        self.store = store
        self.top_k = top_k
        self.rerank_k = rerank_k
        self.min_score = min_score

    def candidates(self, question: str, groups: list[str], include_quarantined: bool, top_k: int | None = None,
                   domain: str | None = None) -> list[dict]:
        q = self.embedder.encode([question])[0]
        if domain:
            return self.store.hybrid_search(q, groups, include_quarantined, top_k or self.top_k, domain=domain)
        return self.store.hybrid_search(q, groups, include_quarantined, top_k or self.top_k)

    def search(self, question: str, groups: list[str], include_quarantined: bool,
               rerank_k: int | None = None, min_score: float | None = None, top_k: int | None = None,
               domain: str | None = None) -> list[Hit]:
        cands = self.candidates(question, groups, include_quarantined, top_k, domain)
        if not cands:
            return []
        scores = self.reranker.score(question, [f"{c['title']}\n{c['text']}" for c in cands])
        ranked = sorted((Hit(c, s) for c, s in zip(cands, scores)), key=lambda h: h.score, reverse=True)
        k = self.rerank_k if rerank_k is None else rerank_k
        floor = self.min_score if min_score is None else min_score
        return [h for h in ranked[:k] if h.score >= floor]
