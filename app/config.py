"""All configuration comes from the environment (.env). No secrets in code."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

# Never fetch models at runtime.
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")


def _path(name: str, default: str) -> Path:
    p = Path(os.getenv(name) or default)
    return p if p.is_absolute() else ROOT / p


def _bool(name: str, default: str) -> bool:
    return (os.getenv(name) or default).strip().lower() in {"1", "on", "true", "yes"}


@dataclass(frozen=True)
class LLMConfig:
    base_url: str
    api_key: str
    model: str
    reasoning_effort: str | None
    timeout: float


@dataclass(frozen=True)
class Settings:
    llm: LLMConfig
    vision: LLMConfig
    mode_label: str
    quant_label: str
    qdrant_url: str
    collection: str
    embed_model_path: Path
    rerank_model_path: Path
    retrieve_top_k: int
    rerank_top_k: int
    rerank_min_score: float
    data_dir: Path
    corpus_dir: Path
    audit_db_path: Path
    users_file: Path
    injection_defence: bool
    tesseract_langs: str
    rerank_fp16: bool
    extra: dict = field(default_factory=dict)


def load_settings() -> Settings:
    llm = LLMConfig(
        base_url=os.getenv("LLM_BASE_URL", "https://models.jarvislabs.net/v1"),
        api_key=os.getenv("LLM_API_KEY", "dummy"),
        model=os.getenv("LLM_MODEL", "glm-5.3-flash"),
        reasoning_effort=os.getenv("LLM_REASONING_EFFORT") or None,
        timeout=float(os.getenv("LLM_TIMEOUT_SECONDS", "120")),
    )
    vision = LLMConfig(
        base_url=os.getenv("VISION_BASE_URL") or llm.base_url,
        api_key=os.getenv("VISION_API_KEY") or llm.api_key,
        model=os.getenv("VISION_MODEL") or llm.model,
        reasoning_effort=llm.reasoning_effort,
        timeout=max(llm.timeout, 180.0),
    )
    return Settings(
        llm=llm,
        vision=vision,
        mode_label=os.getenv("LLM_MODE_LABEL", "Cloud endpoint"),
        quant_label=os.getenv("LLM_QUANT_LABEL", ""),
        qdrant_url=os.getenv("QDRANT_URL", "http://localhost:6333"),
        collection=os.getenv("QDRANT_COLLECTION", "lowkey_docs"),
        embed_model_path=_path("EMBED_MODEL_PATH", "./models/bge-m3"),
        rerank_model_path=_path("RERANK_MODEL_PATH", "./models/bge-reranker-v2-m3"),
        retrieve_top_k=int(os.getenv("RETRIEVE_TOP_K", "30")),
        rerank_top_k=int(os.getenv("RERANK_TOP_K", "7")),
        rerank_min_score=float(os.getenv("RERANK_MIN_SCORE", "0.02")),
        data_dir=_path("DATA_DIR", "./data"),
        corpus_dir=_path("CORPUS_DIR", "./corpus"),
        audit_db_path=_path("AUDIT_DB_PATH", "./data/audit.sqlite"),
        users_file=_path("USERS_FILE", "./config/users.yaml"),
        injection_defence=_bool("INJECTION_DEFENCE", "on"),
        tesseract_langs=os.getenv("TESSERACT_LANGS", "tam+eng"),
        rerank_fp16=_bool("RERANK_FP16", "on"),
    )
