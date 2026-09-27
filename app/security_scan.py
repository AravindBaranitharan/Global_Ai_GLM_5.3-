"""Deterministic security checks the Security Agent runs before asking the model.

The model then confirms or dismisses each finding, so the scanner catches the obvious
things reliably and the model adds judgement. Patterns are deliberately simple.
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass

from ingest.sanitize import injection_matches


@dataclass
class Finding:
    rule: str
    severity: str   # High | Medium | Low
    line: int
    snippet: str
    message: str


RULES: list[tuple[str, str, str, str]] = [
    # (rule id, severity, regex, message)
    ("hardcoded-secret", "High", r"""(?i)\b(api[_-]?key|secret|passw(or)?d|token|access[_-]?key)\b\s*[:=]\s*['"][^'"\s]{6,}['"]""", "Secret hard-coded in source. Load it from a secret manager or environment variable."),
    ("aws-access-key", "High", r"\bAKIA[0-9A-Z]{16}\b", "Looks like an AWS access key ID."),
    ("private-key", "High", r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----", "Private key material in source."),
    ("eval-exec", "High", r"\b(eval|exec)\s*\(", "eval/exec on dynamic input allows code execution."),
    ("shell-true", "High", r"subprocess\.\w+\([^)]*shell\s*=\s*True", "subprocess with shell=True enables command injection."),
    ("os-system", "Medium", r"\bos\.(system|popen)\s*\(", "os.system/os.popen runs a shell; prefer subprocess with an argument list."),
    ("pickle-load", "High", r"\bpickle\.loads?\s*\(", "Unpickling untrusted data allows code execution."),
    ("yaml-unsafe-load", "Medium", r"\byaml\.load\s*\((?![^)]*SafeLoader)", "yaml.load without SafeLoader can construct arbitrary objects; use yaml.safe_load."),
    ("sql-string-build", "High", r"""(?i)(?:(?:execute|query|raw)\s*\(\s*(?:f["']|["'][^"']*["']\s*(?:\+|%))[^\n]*\b(?:select|insert|update|delete)\b|\b(?:select|insert|update|delete)\b[^"'\n]*["']{1,2}\s*(?:\+|%\s))""", "SQL built from strings; use parameterised queries."),
    ("tls-verify-off", "Medium", r"verify\s*=\s*False", "TLS certificate verification disabled."),
    ("weak-hash", "Medium", r"\bhashlib\.(md5|sha1)\s*\(", "MD5/SHA-1 are unsuitable for passwords or integrity; use bcrypt/argon2 or SHA-256+."),
    ("debug-on", "Low", r"\bdebug\s*=\s*True\b", "Debug mode enabled; never ship it to production."),
    ("inner-html", "Medium", r"\.innerHTML\s*=", "Assigning innerHTML with untrusted data enables XSS."),
    ("insecure-random", "Low", r"\brandom\.(random|randint|choice|randrange)\s*\(", "random is not cryptographically secure; use secrets for tokens."),
    ("plain-http", "Low", r"""["']http://(?!localhost|127\.0\.0\.1)""", "Plain HTTP URL; use HTTPS."),
    ("bind-all", "Low", r"""["']0\.0\.0\.0["']""", "Service binds to all interfaces."),
]
_COMPILED = [(r, s, re.compile(p), m) for r, s, p, m in RULES]


_FENCE = re.compile(r"^\s*(```|~~~)")


def code_lines(text: str) -> list[tuple[int, str]]:
    """Lines to scan with their numbers. When the text has fenced code blocks, only the code is
    scanned and lines count from 1 inside each block, which is how a reader (and the model)
    numbers them. Plain pasted code with no fences keeps whole-text numbering."""
    lines = text.splitlines()
    if not any(_FENCE.match(l) for l in lines):
        return list(enumerate(lines, start=1))
    out: list[tuple[int, str]] = []
    inside, no = False, 0
    for line in lines:
        if _FENCE.match(line):
            inside, no = not inside, 0
            continue
        if inside:
            no += 1
            out.append((no, line))
    return out


def scan(text: str) -> list[dict]:
    out: list[Finding] = []
    for no, line in code_lines(text):
        for rule, sev, rx, msg in _COMPILED:
            if rx.search(line):
                out.append(Finding(rule, sev, no, line.strip()[:160], msg))
    if injection_matches(text):
        out.append(Finding("prompt-injection-text", "Medium", 0, "", "Contains instruction-like text aimed at an AI system (possible prompt injection)."))
    order = {"High": 0, "Medium": 1, "Low": 2}
    return [asdict(f) for f in sorted(out, key=lambda f: (order[f.severity], f.line))]
