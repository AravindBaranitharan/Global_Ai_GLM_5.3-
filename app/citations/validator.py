"""Every citation must point at a chunk that was actually retrieved; otherwise refuse."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.prompt.builder import NOT_FOUND

from app.language import LANGUAGES

REFUSAL = {code: l.refusal for code, l in LANGUAGES.items()}

# [S1]  [S1, S3]  [S2][S4]  [s1]  and annotated forms the model also writes: [S1 §2]  [S2: DP-04]
_GROUP_RE = re.compile(r"\[\s*[Ss]\d+\b[^\]\n]{0,60}\]")
_LABEL_RE = re.compile(r"\b[Ss](\d+)\b|(?<=[,;]\s)(\d+)\b|(?<=[,;])(\d+)\b")


@dataclass
class Validated:
    answer: str
    refused: bool
    cited: list[str] = field(default_factory=list)     # valid labels, in first-use order
    invalid: list[str] = field(default_factory=list)   # labels the model made up


# A Markdown table cell that holds only source labels, e.g. "| S8 |" or "| S1, S4 |" in a Source column.
_TABLE_CELL_RE = re.compile(r"(?<=\|)\s*([Ss]\d+(?:\s*[,;/]\s*[Ss]?\d+)*)\s*(?=\|)")


def _bracket_table_labels(text: str) -> str:
    """Models often write bare labels in a table's Source column; treat those cells as citations.
    Only whole cells are converted, so prose such as "an S3 bucket" is never mistaken for one."""
    def row(line: str) -> str:
        if not line.lstrip().startswith("|"):
            return line
        return _TABLE_CELL_RE.sub(lambda m: " " + "".join(f"[S{n}]" for n in re.findall(r"\d+", m.group(1))) + " ", line)
    return "\n".join(row(l) for l in text.split("\n"))


def validate(raw: str, valid_labels: set[str], lang: str, require_citations: bool = True) -> Validated:
    text = _bracket_table_labels(raw.strip())
    if not text or text.strip(" .`*").upper() == NOT_FOUND or text.upper().startswith(NOT_FOUND):
        return Validated(REFUSAL.get(lang, REFUSAL["en"]), refused=True)

    cited: list[str] = []
    invalid: list[str] = []

    def fix(m: re.Match) -> str:
        keep = []
        for groups in _LABEL_RE.findall(m.group(0)):
            label = f"S{next(g for g in groups if g)}"
            if label in valid_labels:
                keep.append(label)
                if label not in cited:
                    cited.append(label)
            elif label not in invalid:
                invalid.append(label)
        return "".join(f"[{l}]" for l in keep)

    text = _GROUP_RE.sub(fix, text)
    text = text.replace(NOT_FOUND, "").strip()
    if not cited and require_citations:
        # No supported claim survives: refuse rather than return an uncited answer.
        return Validated(REFUSAL.get(lang, REFUSAL["en"]), refused=True, invalid=invalid)
    return Validated(re.sub(r"[ \t]+([.,;:])", r"\1", text), refused=False, cited=cited, invalid=invalid)
