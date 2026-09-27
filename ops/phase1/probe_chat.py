"""Phase 1: one text call to LLM_BASE_URL. Proves the key, the model name and the OpenAI-compatible API.

    python -m ops.phase1.probe_chat
"""
from app.config import load_settings
from app.llm.client import LLMClient

s = load_settings()
print(f"endpoint={s.llm.base_url} model={s.llm.model} reasoning_effort={s.llm.reasoning_effort}")
r = LLMClient(s.llm).chat([{"role": "user", "content": "Reply with one short sentence in English, then the same sentence in Tamil."}], max_tokens=200)
print(f"model={r.model} latency={r.latency_ms}ms tokens in/out={r.prompt_tokens}/{r.completion_tokens}\n{r.text}")
