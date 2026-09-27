import pytest

from app.language import LANGUAGES, detect, ocr_langs, prompt_name, refusal, resolve
from app.answer import AnswerService, User
from app.audit.log import AuditLog
from app.llm.client import LLMResult
from ingest.render import text_layer_broken

SAMPLES = {
    "en": "How should passwords be stored in our services?",
    "ta": "கடவுச்சொற்களை எப்படி சேமிக்க வேண்டும்?",
    "hi": "पासवर्ड को कैसे संग्रहीत करना चाहिए?",
    "te": "పాస్‌వర్డ్‌లను ఎలా నిల్వ చేయాలి?",
    "kn": "ಪಾಸ್‌ವರ್ಡ್‌ಗಳನ್ನು ಹೇಗೆ ಸಂಗ್ರಹಿಸಬೇಕು?",
    "ml": "പാസ്‌വേഡുകൾ എങ്ങനെ സംഭരിക്കണം?",
    "bn": "পাসওয়ার্ড কীভাবে সংরক্ষণ করা উচিত?",
    "fr": "Comment faut-il stocker les mots de passe dans nos services ?",
    "es": "¿Cómo se deben almacenar las contraseñas en nuestros servicios?",
}


@pytest.mark.parametrize("code,text", SAMPLES.items())
def test_detects_every_supported_language(code, text):
    assert detect(text) == code


def test_code_and_identifiers_do_not_decide_the_language():
    assert detect("इस कोड की समीक्षा करें:\n```python\ndef refund(order_id, amount):\n    return db.execute(query)\n```") == "hi"
    assert detect("Revisa este código:\n```python\nAPI_KEY = 'sk-live-123'\n```\npor favor, gracias") == "es"
    assert detect("What is SEC-10?") == "en"          # too short to be anything but the default


def test_forced_language_wins_over_detection():
    assert resolve("hi", "How do I verify a webhook?") == "hi"
    assert resolve("auto", SAMPLES["te"]) == "te"
    assert resolve("xx", SAMPLES["bn"]) == "bn"        # unknown code falls back to detection
    assert resolve(None, "hello there, how are you today?") == "en"


def test_every_language_has_refusal_prompt_name_and_ocr_pack():
    assert set(LANGUAGES) == set(SAMPLES)
    for code in SAMPLES:
        assert refusal(code) and prompt_name(code)
    assert "Devanagari" in prompt_name("hi") and prompt_name("fr") == "French"
    assert ocr_langs(SAMPLES["ml"]) == "eng+mal" and ocr_langs("plain English page") == "eng"


def test_broken_text_layers_are_detected_in_other_indian_scripts():
    clean_hi = "आपके पास उपलब्ध दस्तावेज़ों में मुझे यह नहीं मिला और यह परीक्षण के लिए है"
    broken_hi = "ि आपके ¹ पास ्उपलब्ध दस्ता¸वेज़ों ि में मुझे"
    assert not text_layer_broken(clean_hi)
    assert text_layer_broken(broken_hi)


class _Retriever:
    def __init__(self, hits):
        self.hits = hits

    def search(self, *a, **kw):
        return self.hits


class _LLM:
    class cfg:
        model = "m"
        base_url = "http://x"

    def __init__(self):
        self.system = None

    def chat(self, messages, **kw):
        self.system = messages[0]["content"]
        return LLMResult("उत्तर [S1]", "m", 1, 1, 1)


def test_forced_language_reaches_the_prompt_and_refusals(tmp_path):
    from app.retrieval.search import Hit
    hit = Hit({"chunk_id": "d:p1:c0", "doc_id": "d", "title": "Doc", "page": 1, "text": "Argon2id", "bboxes": []}, 0.9)
    user = User("u", "U", "", ["all"])
    llm = _LLM()
    svc = AnswerService(_Retriever([hit]), llm, AuditLog(tmp_path / "a.sqlite"), mode_label="x")
    ans = svc.ask(user, "How must passwords be stored?", defence=True, agent="expert", language="hi")
    assert ans.lang == "hi" and "Hindi" in llm.system and "Keep code" in llm.system
    # grounded agent with no sources refuses in the requested language
    empty = AnswerService(_Retriever([]), _LLM(), AuditLog(tmp_path / "b.sqlite"), mode_label="x")
    r = empty.ask(user, "What is our autoscaling policy?", defence=True, agent="expert_strict", language="bn")
    assert r.refused and r.answer == LANGUAGES["bn"].refusal and r.lang == "bn"


def test_weak_non_english_match_retries_with_an_english_translation(tmp_path):
    from app.retrieval.search import Hit
    weak = Hit({"chunk_id": "a", "doc_id": "d", "title": "T", "page": 1, "text": "x", "bboxes": []}, 0.004)
    strong = Hit({"chunk_id": "b", "doc_id": "d", "title": "T", "page": 2, "text": "Argon2id", "bboxes": []}, 0.62)

    class R:
        def __init__(self):
            self.queries = []

        def search(self, q, groups, **kw):
            self.queries.append(q)
            return [strong] if q.startswith("How") else [weak]

    class L:
        class cfg:
            model = "m"
            base_url = "x"

        def __init__(self):
            self.calls = []

        def chat(self, messages, **kw):
            self.calls.append(messages[0]["content"][:30])
            if messages[0]["content"].startswith("Translate"):
                return LLMResult("How should passwords be stored?", "m", 1, 1, 1)
            return LLMResult("Argon2id వాడండి [S1]", "m", 1, 1, 1)

    r, l = R(), L()
    svc = AnswerService(r, l, AuditLog(tmp_path / "a.sqlite"), mode_label="x")
    ans = svc.ask(User("u", "U", "", ["all"]), SAMPLES["te"], defence=True, agent="expert")
    assert ans.lang == "te" and ans.search_query == "How should passwords be stored?"
    assert r.queries == [SAMPLES["te"], "How should passwords be stored?"]
    assert ans.retrieved[0]["chunk_id"] == "b"          # the English search's better passage wins
    svc.ask(User("u", "U", "", ["all"]), SAMPLES["te"], defence=True, agent="expert")
    assert sum(c.startswith("Translate") for c in l.calls) == 1   # translation cached


def test_english_and_strong_matches_never_translate(tmp_path):
    from app.retrieval.search import Hit
    good = Hit({"chunk_id": "a", "doc_id": "d", "title": "T", "page": 1, "text": "x", "bboxes": []}, 0.8)

    class R:
        def search(self, q, groups, **kw):
            return [good]

    llm = _LLM()
    svc = AnswerService(R(), llm, AuditLog(tmp_path / "a.sqlite"), mode_label="x")
    ans = svc.ask(User("u", "U", "", ["all"]), SAMPLES["hi"], defence=True, agent="expert")
    assert ans.search_query is None
