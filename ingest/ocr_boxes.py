"""Tesseract word boxes for scans, used only to highlight where a chunk sits on the page.

GLM does the transcription; Tesseract only answers "where on the page is this text".
If Tesseract is missing we fall back to page-level citations (no highlight).
"""
from __future__ import annotations

import re
import shutil
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

TOKEN_RE = re.compile(r"[\w஀-௿]+", re.UNICODE)
LINE_MATCH_RATIO = 0.6


@dataclass
class OcrLine:
    words: list[str]
    bbox: list[float]
    text: str = ""      # the line as Tesseract read it, for matching answer facts


def tokens(text: str) -> list[str]:
    return [t.lower() for t in TOKEN_RE.findall(text)]


def tesseract_available() -> bool:
    return shutil.which("tesseract") is not None


def available_langs(requested: str) -> str:
    import pytesseract
    have = set(pytesseract.get_languages(config=""))
    langs = [l for l in requested.split("+") if l in have]
    return "+".join(langs) or "eng"


def estimate_skew(img: Image.Image) -> float:
    """Small-angle deskew: the rotation whose horizontal ink profile is sharpest (text rows aligned)."""
    g = img.convert("L")
    g.thumbnail((900, 900))
    ink = g.point(lambda v: 255 if v < 140 else 0)
    best, best_score = 0.0, -1.0
    for tenth in range(-40, 41, 2):  # -4.0 .. +4.0 degrees
        angle = tenth / 10
        r = ink.rotate(angle, resample=Image.NEAREST, fillcolor=0)
        w, h = r.size
        px = r.load()
        rows = [sum(1 for x in range(0, w, 3) if px[x, y]) for y in range(h)]
        score = sum((rows[i] - rows[i - 1]) ** 2 for i in range(1, h))
        if score > best_score:
            best, best_score = angle, score
    return best


def ocr_lines(image: Path, langs: str) -> list[OcrLine]:
    """Words grouped into visual rows, with boxes on the original image.

    Sparse-text mode (--psm 11) is used because the default layout analysis drops
    ruled table rows (totals, tax lines). OCR runs on the original pixels (resampling
    loses bold text); the estimated skew is used only to decide which words share a row,
    so a total on the far right of a tilted scan stays on the same row as its label.
    """
    if not tesseract_available():
        return []
    import math
    import pytesseract
    img = Image.open(image).convert("RGB")
    w, h = img.size
    tilt = math.tan(math.radians(estimate_skew(img)))
    data = pytesseract.image_to_data(img, lang=available_langs(langs), config="--psm 11", output_type=pytesseract.Output.DICT)
    words = []
    for i, word in enumerate(data["text"]):
        if not word.strip() or float(data["conf"][i]) < 30:
            continue
        x, y, bw, bh = data["left"][i], data["top"][i], data["width"][i], data["height"][i]
        # Height of the word centre once the page is levelled (PIL rotates counter-clockwise).
        level_y = (y + bh / 2) - ((x + bw / 2) - w / 2) * tilt
        words.append((x, y, x + bw, y + bh, word, level_y, bh))

    rows: list[list[tuple]] = []
    for wd in sorted(words, key=lambda t: t[5]):
        if rows:
            last = rows[-1]
            centre = sum(t[5] for t in last) / len(last)
            if abs(wd[5] - centre) <= 0.5 * max(wd[6], max(t[6] for t in last)):
                last.append(wd)
                continue
        rows.append([wd])

    out = []
    for row in rows:
        row.sort(key=lambda t: t[0])
        toks = [t for wd in row for t in tokens(wd[4])]
        if not toks:
            continue
        x0, y0 = min(t[0] for t in row), min(t[1] for t in row)
        x1, y1 = max(t[2] for t in row), max(t[3] for t in row)
        out.append(OcrLine(words=toks, text=" ".join(t[4] for t in row),
                           bbox=[round(x0 / w, 4), round(y0 / h, 4), round(x1 / w, 4), round(y1 / h, 4)]))
    return out


def align_lines(chunk_text: str, lines: list[OcrLine]) -> list[OcrLine]:
    """OCR lines whose words mostly appear in the chunk text."""
    vocab = set(tokens(chunk_text))
    if not vocab:
        return []
    out = []
    for line in lines:
        hits = sum(1 for w in line.words if w in vocab)
        if hits / len(line.words) >= LINE_MATCH_RATIO and (hits >= 2 or len(line.words) == 1):
            out.append(line)
    return out


def align(chunk_text: str, lines: list[OcrLine]) -> list[list[float]]:
    return [l.bbox for l in align_lines(chunk_text, lines)]
