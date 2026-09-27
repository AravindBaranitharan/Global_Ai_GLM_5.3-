"""OpenAI-compatible Chat Completions client.

Cloud (Jarvis Labs) and self-hosted (llama-server) differ only in LLM_BASE_URL.
"""
from __future__ import annotations

import base64
import mimetypes
import time
from dataclasses import dataclass
from pathlib import Path

from openai import OpenAI

from app.config import LLMConfig


@dataclass
class LLMResult:
    text: str
    model: str
    latency_ms: int
    prompt_tokens: int | None
    completion_tokens: int | None


def image_data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "image/png"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"


class LLMClient:
    def __init__(self, cfg: LLMConfig):
        self.cfg = cfg
        self._client = OpenAI(base_url=cfg.base_url, api_key=cfg.api_key, timeout=cfg.timeout)

    def chat(self, messages: list[dict], *, temperature: float = 0.1, max_tokens: int = 1500) -> LLMResult:
        kwargs: dict = {}
        if self.cfg.reasoning_effort:
            # Sent in the body so non-OpenAI servers receive it verbatim.
            kwargs["extra_body"] = {"reasoning_effort": self.cfg.reasoning_effort}
        start = time.perf_counter()
        resp = self._client.chat.completions.create(
            model=self.cfg.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        )
        latency = int((time.perf_counter() - start) * 1000)
        usage = resp.usage
        return LLMResult(
            text=(resp.choices[0].message.content or "").strip(),
            model=resp.model or self.cfg.model,
            latency_ms=latency,
            prompt_tokens=getattr(usage, "prompt_tokens", None),
            completion_tokens=getattr(usage, "completion_tokens", None),
        )

    def describe_image(self, image: Path, instruction: str, *, max_tokens: int = 3000) -> LLMResult:
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": image_data_uri(image)}},
                    {"type": "text", "text": instruction},
                ],
            }
        ]
        return self.chat(messages, temperature=0.0, max_tokens=max_tokens)
