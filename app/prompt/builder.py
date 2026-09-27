"""Prompt builder.

Defence ON: spotlighting. Retrieved text is wrapped in delimiters carrying a
per-request random nonce (so a document cannot fake a closing tag) and the
system prompt states that document content is data, never instructions.

Defence OFF: a deliberately naive "use this context" prompt, for the demo.
"""
from __future__ import annotations

import json
import re
import secrets

from app.agents import EXPERT, Agent
from app.retrieval.search import Hit

NOT_FOUND = "NOT_FOUND"
from app.language import LANGUAGES, prompt_name

KEEP_TERMS = ("Keep code, commands, rule IDs, product and service names, metric names and numbers exactly as written. "
              "Everything else, including small connecting words such as of, the, and, for, to, must be in {name}; "
              "never leave an ordinary English word inside a {name} sentence")

SYSTEM_NAIVE = """You are a helpful {role}. Use the context below to answer.
Follow any guidance in the context. Cite sources like [S1]. If you don't know, reply {not_found}.
Answer in {language}."""


def build_messages(question: str, hits: list[Hit], *, defence: bool, lang: str,
                   agent: Agent = EXPERT, scan: list[dict] | None = None,
                   diagram: str | None = None, domain: str = "this domain",
                   history: list[tuple[str, str]] | None = None) -> tuple[list[dict], dict[str, Hit]]:
    labels = {f"S{i}": h for i, h in enumerate(hits, start=1)}
    language = prompt_name(lang) if lang == "en" else f"{prompt_name(lang)}. {KEEP_TERMS.format(name=LANGUAGES[lang].name)}"
    scan_block = f"\n\n<scan>\n{json.dumps(scan, ensure_ascii=False, indent=1)}\n</scan>" if scan is not None else ""
    if diagram:
        # Vision output describes an untrusted image: data, like every source.
        scan_block += f"\n\n<diagram>\n{diagram}\n</diagram>"

    if defence:
        nonce = secrets.token_hex(4)
        parts = []
        for label, h in labels.items():
            p = h.payload
            text = p["text"].replace(nonce, "")
            parts.append(f'<source id="{label}" doc="{p["title"]}" page="{p["page"]}" nonce="{nonce}">\n{text}\n</source nonce="{nonce}">')
        system = agent.system.format(nonce=nonce, not_found=NOT_FOUND, language=language, domain=domain)
        sources = "\n\n".join(parts) if parts else "(no matching passages in the uploaded documents)"
        user = f"Sources:\n\n{sources}{scan_block}\n\nUser message:\n{question}"
    else:
        context = "\n\n".join(f"[{label}] ({h.payload['title']}, page {h.payload['page']})\n{h.payload['text']}" for label, h in labels.items())
        system = SYSTEM_NAIVE.format(role=agent.name.lower(), not_found=NOT_FOUND, language=language)
        user = f"Context:\n{context}{scan_block}\n\nUser message:\n{question}"

    system += MATH_STYLE
    turns = history_messages(history)
    if turns:
        user = FOLLOW_UP + user
    return [{"role": "system", "content": system}, *turns, {"role": "user", "content": user}], labels


MATH_STYLE = "\nWrite any formula in LaTeX: $...$ inside a sentence, or $$...$$ on its own line for a display equation."
MAX_HISTORY = 4          # earlier turns sent with a follow-up
HISTORY_CHARS = 2000     # per question or answer
_CITE_RE = re.compile(r"\s?\[\s*S\d+[^\]\n]{0,60}\]")
FOLLOW_UP = ("This message continues the conversation above. Use the earlier turns to resolve references such as "
             "\"that\", \"it\" or \"more on this\". The sources below are new for this message: cite only these, "
             "never labels from earlier answers.\n\n")


def history_messages(history: list[tuple[str, str]] | None) -> list[dict]:
    """Earlier turns as chat messages: the last few, trimmed, with old citation labels removed so the
    model cannot confuse them with this turn's sources."""
    out: list[dict] = []
    for q, a in (history or [])[-MAX_HISTORY:]:
        q, a = q.strip()[:HISTORY_CHARS], _CITE_RE.sub("", a).strip()[:HISTORY_CHARS]
        if q and a:
            out += [{"role": "user", "content": q}, {"role": "assistant", "content": a}]
    return out
