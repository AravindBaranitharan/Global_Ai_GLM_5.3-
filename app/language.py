"""Supported languages: detection, prompt wording, refusal text and OCR codes.

Indian languages are detected by script (each has its own Unicode block). Latin-script text is
told apart among English, French and Spanish with lingua, which runs offline. Code blocks and
inline code are ignored so a pasted snippet does not decide the language.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class Lang:
    code: str
    name: str        # English name, used in prompts
    native: str      # shown in the UI
    script: str      # prompt hint
    tesseract: str   # OCR language pack
    refusal: str


LANGUAGES: dict[str, Lang] = {l.code: l for l in (
    Lang("en", "English", "English", "Latin", "eng", "I could not find this in the documents you have access to."),
    Lang("ta", "Tamil", "தமிழ்", "Tamil", "tam", "நீங்கள் அணுகக்கூடிய ஆவணங்களில் இதை என்னால் கண்டுபிடிக்க முடியவில்லை."),
    Lang("hi", "Hindi", "हिन्दी", "Devanagari", "hin", "आपके पास उपलब्ध दस्तावेज़ों में मुझे यह नहीं मिला।"),
    Lang("te", "Telugu", "తెలుగు", "Telugu", "tel", "మీకు అందుబాటులో ఉన్న పత్రాలలో నాకు ఇది కనిపించలేదు."),
    Lang("kn", "Kannada", "ಕನ್ನಡ", "Kannada", "kan", "ನಿಮಗೆ ಲಭ್ಯವಿರುವ ದಾಖಲೆಗಳಲ್ಲಿ ನನಗೆ ಇದು ಸಿಗಲಿಲ್ಲ."),
    Lang("ml", "Malayalam", "മലയാളം", "Malayalam", "mal", "നിങ്ങൾക്ക് ലഭ്യമായ രേഖകളിൽ എനിക്ക് ഇത് കണ്ടെത്താനായില്ല."),
    Lang("bn", "Bengali", "বাংলা", "Bengali", "ben", "আপনার অ্যাক্সেস থাকা নথিগুলিতে আমি এটি খুঁজে পাইনি।"),
    Lang("fr", "French", "Français", "Latin", "fra", "Je n'ai pas trouvé cette information dans les documents auxquels vous avez accès."),
    Lang("es", "Spanish", "Español", "Latin", "spa", "No encontré esta información en los documentos a los que tienes acceso."),
)}

# Unicode blocks for the Indian scripts we support.
SCRIPTS: dict[str, tuple[int, int]] = {
    "hi": (0x0900, 0x097F),   # Devanagari
    "bn": (0x0980, 0x09FF),   # Bengali
    "ta": (0x0B80, 0x0BFF),   # Tamil
    "te": (0x0C00, 0x0C7F),   # Telugu
    "kn": (0x0C80, 0x0CFF),   # Kannada
    "ml": (0x0D00, 0x0D7F),   # Malayalam
}
INDIC_RANGES = list(SCRIPTS.values())
_CODE_RE = re.compile(r"```.*?```|`[^`\n]*`", re.S)


def _script_of(ch: str) -> str | None:
    o = ord(ch)
    for code, (lo, hi) in SCRIPTS.items():
        if lo <= o <= hi:
            return code
    return None


def is_indic(ch: str) -> bool:
    o = ord(ch)
    return any(lo <= o <= hi for lo, hi in INDIC_RANGES)


@lru_cache(maxsize=1)
def _latin_detector():
    from lingua import Language, LanguageDetectorBuilder
    return LanguageDetectorBuilder.from_languages(Language.ENGLISH, Language.FRENCH, Language.SPANISH).build()


_LINGUA = {"ENGLISH": "en", "FRENCH": "fr", "SPANISH": "es"}


def detect(text: str) -> str:
    """Language code of a question or passage. Defaults to English."""
    prose = _CODE_RE.sub(" ", text)
    counts: dict[str, int] = {}
    latin = 0
    for ch in prose:
        if not ch.isalpha() and unicodedata.category(ch)[0] != "M":
            continue
        s = _script_of(ch)
        if s:
            counts[s] = counts.get(s, 0) + 1
        elif ch.isascii() or unicodedata.name(ch, "").startswith("LATIN"):
            latin += 1
    letters = latin + sum(counts.values())
    if not letters:
        return "en"
    if counts:
        best = max(counts, key=counts.get)
        if counts[best] / letters > 0.3:
            return best
    if latin < 12:          # too short to tell French or Spanish from English reliably
        return "en"
    try:
        found = _latin_detector().detect_language_of(prose)
    except Exception:
        return "en"
    return _LINGUA.get(found.name, "en") if found else "en"


def resolve(requested: str | None, question: str) -> str:
    """A forced language if valid, otherwise the question's own language."""
    if requested and requested != "auto" and requested in LANGUAGES:
        return requested
    return detect(question)


def prompt_name(code: str) -> str:
    l = LANGUAGES.get(code, LANGUAGES["en"])
    if code == "en":
        return "English"
    return f"{l.name} ({l.native}), written in {l.script} script" if l.script != "Latin" else l.name


def refusal(code: str) -> str:
    return LANGUAGES.get(code, LANGUAGES["en"]).refusal


def ocr_langs(text: str) -> str:
    """Tesseract languages for a page: English plus the page's own language."""
    code = detect(text)
    return "eng" if code == "en" else f"eng+{LANGUAGES[code].tesseract}"
