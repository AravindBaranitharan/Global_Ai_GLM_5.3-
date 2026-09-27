"""The /ask flow: ACL retrieval -> prompt -> LLM -> citation validation -> output check -> audit."""
from __future__ import annotations

import time
from collections.abc import Callable
from pathlib import Path
from dataclasses import dataclass, field

from app.language import resolve
from app.agents import AGENTS, EXPERT
from app.citations.output_check import check_output
from app.citations.validator import REFUSAL, validate
from app.prompt.builder import MAX_HISTORY, build_messages
from app.security_scan import scan as security_scan
from ingest.sanitize import injection_matches


@dataclass
class User:
    id: str
    name: str
    title: str
    groups: list[str]


@dataclass
class Answer:
    answer: str
    refused: bool
    lang: str
    citations: list[dict] = field(default_factory=list)
    retrieved: list[dict] = field(default_factory=list)
    flags: list[dict] = field(default_factory=list)
    invalid_citations: list[str] = field(default_factory=list)
    endpoint_label: str = ""
    model: str = ""
    latency_ms: int = 0
    llm_latency_ms: int | None = None
    injection_defence: bool = True
    audit_id: int | None = None
    error: str | None = None
    agent: str = "expert"
    checks: list[dict] = field(default_factory=list)   # static scanner findings (Security Agent)
    diagram: str | None = None                          # GLM vision's reading of an attached diagram
    search_query: str | None = None                     # English query used when the question's own language matched weakly


def sections(text: str, limit: int = 12, target: int = 280) -> list[str]:
    """Split a pasted document into searchable sections: headings and bullets grouped to ~target chars."""
    out, buf = [], ""
    for line in (l.strip() for l in text.splitlines()):
        if not line:
            continue
        if buf and (len(buf) + len(line) > target or line.startswith("#")):
            out.append(buf)
            buf = ""
        buf = f"{buf} {line}".strip()
    if buf:
        out.append(buf)
    return [s for s in out if len(s) > 25][:limit]


def _source(label: str | None, h) -> dict:
    p = h.payload
    return {
        "label": label,
        "chunk_id": p["chunk_id"],
        "doc_id": p["doc_id"],
        "title": p["title"],
        "page": p["page"],
        "text": p["text"],
        "bboxes": p.get("bboxes") or [],
        "lines": p.get("lines") or [],
        "source_type": p.get("source_type"),
        "quarantined": p.get("quarantined", False),
        "flags": p.get("flags") or [],
        "score": round(h.score, 4),
    }


class AnswerService:
    def __init__(self, retriever, llm, audit, *, mode_label: str,
                 diagram_reader: Callable[[Path], tuple[str, bool]] | None = None):
        self.retriever = retriever
        self.llm = llm
        self.audit = audit
        self.mode_label = mode_label
        self.diagram_reader = diagram_reader
        self._translations: dict[str, str] = {}

    # Cross-language reranker scores are low for short non-English questions (a Telugu question
    # scored 0.006 on the right passage, under the 0.02 cut-off). When a non-English question gets
    # only weak matches, search again with an English translation and merge.
    WEAK_MATCH = 0.1

    def _to_english(self, question: str) -> str | None:
        if question in self._translations:
            return self._translations[question]
        try:
            res = self.llm.chat([
                {"role": "system", "content": "Translate the user's text into English for a search engine. "
                 "Output only the translation. Keep code, product names, rule IDs and numbers unchanged."},
                {"role": "user", "content": question[:1500]}], temperature=0.0, max_tokens=200)
        except Exception:
            return None
        text = res.text.strip().strip('"')
        self._translations[question] = text
        return text or None

    def _search_multilingual(self, query: str, lang: str, groups: list[str], **kw) -> tuple[list, str | None]:
        hits = self.retriever.search(query, groups, **kw)
        if lang == "en" or (hits and hits[0].score >= self.WEAK_MATCH):
            return hits, None
        english = self._to_english(query)
        if not english:
            return hits, None
        best = {h.chunk_id: h for h in hits}
        for h in self.retriever.search(english, groups, **kw):
            if h.chunk_id not in best or best[h.chunk_id].score < h.score:
                best[h.chunk_id] = h
        k = kw.get("rerank_k") or len(best)
        return sorted(best.values(), key=lambda h: h.score, reverse=True)[:k], english

    def _search_by_section(self, text: str, groups: list[str], *, include_quarantined: bool, keep: int):
        """A long design doc is a poor single query. Search each section, keep the best passages per
        section, and merge, so every rule area the document touches is in front of the model."""
        best: dict[str, object] = {}
        for part in sections(text):
            for h in self.retriever.search(part, groups, include_quarantined=include_quarantined,
                                           rerank_k=3, min_score=0.0, top_k=10):
                if h.chunk_id not in best or best[h.chunk_id].score < h.score:
                    best[h.chunk_id] = h
        return sorted(best.values(), key=lambda h: h.score, reverse=True)[:keep]

    def ask(self, user: User, question: str, *, defence: bool, agent: str = "expert",
            image: Path | None = None, audit_agent: str | None = None,
            domain: str | None = None, domain_name: str | None = None, language: str | None = None,
            history: list[tuple[str, str]] | None = None) -> Answer:
        start = time.perf_counter()
        role = AGENTS.get(agent, EXPERT)
        lang = resolve(language, question)   # "auto"/None: answer in the question's language
        diagram = None
        if role.reads_diagram and image is not None and self.diagram_reader is not None:
            diagram, _ = self.diagram_reader(image)
        # Long pasted code makes a poor search query; the first part carries the intent.
        query = f"{question}\n{diagram}" if diagram else question
        # A follow-up such as "explain that mathematically" has no topic of its own, so the search also
        # carries the previous question. The prompt gets the full recent history.
        history = [(q, a) for q, a in (history or []) if q.strip()][-MAX_HISTORY:]
        search_text = f"{history[-1][0][:500]}\n{query}" if history else query
        # Defence off also lets quarantined chunks through, so the planted attack can be shown working.
        translated = None
        if role.decompose and len(query) > 600:
            hits = self._search_by_section(query, user.groups, include_quarantined=not defence, keep=role.rerank_k or 12)
        else:
            kw = {"domain": domain} if domain else {}
            hits, translated = self._search_multilingual(search_text[:2000], lang, user.groups, include_quarantined=not defence,
                                                          rerank_k=role.rerank_k, min_score=role.min_score, **kw)
        ans = Answer(answer="", refused=False, lang=lang, endpoint_label=self.mode_label,
                     model=self.llm.cfg.model, injection_defence=defence,
                     retrieved=[_source(None, h) for h in hits], agent=role.id, diagram=diagram,
                     search_query=translated)
        if role.runs_scanner:
            ans.checks = security_scan(question)
        if diagram and injection_matches(diagram):
            ans.flags.append({"type": "diagram_injection", "value": "instruction-like text inside the image"})

        for h in hits:
            if h.payload.get("quarantined"):
                ans.flags.append({"type": "quarantined_chunk_used", "value": h.chunk_id})

        if not hits and role.refuse_without_sources:
            ans.answer, ans.refused = REFUSAL.get(lang, REFUSAL["en"]), True
        else:
            messages, labels = build_messages(question, hits, defence=defence, lang=lang, agent=role,
                                              scan=ans.checks if role.runs_scanner else None, diagram=diagram,
                                              domain=domain_name or "this domain", history=history)
            try:
                res = self.llm.chat(messages, max_tokens=role.max_tokens)
                ans.llm_latency_ms, ans.model = res.latency_ms, res.model
                v = validate(res.text, set(labels), lang, require_citations=role.require_citations)
                ans.refused, ans.invalid_citations = v.refused, v.invalid
                if v.invalid:
                    ans.flags.append({"type": "invalid_citations", "value": ", ".join(v.invalid)})
                if v.refused or not role.output_check:
                    text, out_flags = v.answer, []
                else:
                    text, out_flags = check_output(v.answer, question, redact=defence)
                ans.answer = text
                ans.flags.extend(out_flags)
                for label in v.cited:
                    for r in ans.retrieved:
                        if r["chunk_id"] == labels[label].chunk_id:
                            r["label"] = label
                ans.citations = [_source(label, labels[label]) for label in v.cited]
            except Exception as e:
                ans.error = f"{type(e).__name__}: {e}"
                ans.answer = "The model endpoint failed to answer. Please try again."
                ans.refused = True

        ans.latency_ms = int((time.perf_counter() - start) * 1000)
        ans.audit_id = self.audit.write(
            user_id=user.id, user_name=user.name, groups=user.groups,
            question=question + (" [diagram attached]" if image is not None else ""), lang=lang,
            retrieved=[r["chunk_id"] for r in ans.retrieved], cited=[c["chunk_id"] for c in ans.citations],
            invalid_citations=ans.invalid_citations, refused=ans.refused, answer=ans.answer,
            endpoint_label=self.mode_label, endpoint_url=self.llm.cfg.base_url, model=ans.model,
            injection_defence=defence, flags=ans.flags, latency_ms=ans.latency_ms, agent=audit_agent or role.id,
            llm_latency_ms=ans.llm_latency_ms, error=ans.error,
        )
        return ans
