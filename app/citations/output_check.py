"""Output check: flag URLs, emails and phone numbers the user never asked about.

With defence on, flagged items are also redacted from the answer.
"""
from __future__ import annotations

import re

URL_RE = re.compile(r"(?:https?://|www\.)[^\s)\]>\"']+|\b[a-z0-9-]+\.(?:com|net|org|io|in|xyz|ru|co|info|biz|top)(?:/[^\s)\]>\"']*)?\b", re.I)
EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
PHONE_RE = re.compile(r"(?<!\w)\+?\d[\d\s-]{8,}\d(?!\w)")
REDACTED = "[removed by output check]"


def check_output(answer: str, question: str, *, redact: bool) -> tuple[str, list[dict]]:
    flags = []
    q = question.lower()
    for kind, rx in (("email", EMAIL_RE), ("url", URL_RE), ("phone", PHONE_RE)):
        for m in rx.finditer(answer):
            value = m.group(0).rstrip(".,;")
            if value.lower() in q:
                continue
            if kind == "url" and "@" in answer[max(0, m.start() - 1):m.start() + 1]:
                continue  # domain part of an email, already reported
            flags.append({"type": f"unexpected_{kind}", "value": value})
    if redact:
        for f in flags:
            answer = answer.replace(f["value"], REDACTED)
    return answer, flags
