"""FastAPI routes: /ask (three agents), /documents (list, upload, delete), /audit, /health, /about."""
from __future__ import annotations

import json
import re
import threading
from dataclasses import asdict
from functools import lru_cache
from pathlib import Path

import yaml
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from typing import Literal

from pydantic import BaseModel, Field
from qdrant_client import QdrantClient

import base64
import hashlib

from app.agents import AGENTS
from app.language import LANGUAGES
from app.answer import AnswerService, User
from app.audit.log import AuditLog
from app.config import ROOT, load_settings
from app.llm.client import LLMClient
from app.retrieval.store import VectorStore

settings = load_settings()
app = FastAPI(title="Domain Specialist RAG")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"])

_state = {"injection_defence": settings.injection_defence}
_ingest_lock = threading.Lock()


def load_users() -> dict[str, User]:
    data = yaml.safe_load(settings.users_file.read_text())
    return {u["id"]: User(u["id"], u["name"], u.get("title", ""), list(u["groups"])) for u in data["users"]}


@lru_cache
def store() -> VectorStore:
    return VectorStore(QdrantClient(url=settings.qdrant_url), settings.collection)


@lru_cache
def embedder():
    from app.retrieval.models import Embedder
    return Embedder(settings.embed_model_path)


@lru_cache
def service() -> AnswerService:
    from app.retrieval.models import Reranker
    from app.retrieval.search import Retriever
    retriever = Retriever(embedder(), Reranker(settings.rerank_model_path, fp16=settings.rerank_fp16), store(),
                          top_k=settings.retrieve_top_k, rerank_k=settings.rerank_top_k,
                          min_score=settings.rerank_min_score)
    return AnswerService(retriever, LLMClient(settings.llm), audit(), mode_label=settings.mode_label,
                         diagram_reader=read_diagram)


@lru_cache
def vision():
    from ingest.vision import VisionTranscriber
    return VisionTranscriber(LLMClient(settings.vision), settings.data_dir / "cache" / "vision")


def read_diagram(image: Path) -> tuple[str, bool]:
    from ingest.vision import DIAGRAM_PROMPT, DIAGRAM_PROMPT_VERSION
    return vision().transcribe(image, prompt=DIAGRAM_PROMPT, version=DIAGRAM_PROMPT_VERSION)


@lru_cache
def audit() -> AuditLog:
    return AuditLog(settings.audit_db_path)


def registry() -> dict:
    path = settings.data_dir / "docs.json"
    return json.loads(path.read_text()) if path.exists() else {}


@app.on_event("startup")
def warm_up() -> None:
    # Load models in the background so the first question is not slow on stage.
    threading.Thread(target=service, daemon=True).start()


class HistoryTurn(BaseModel):
    question: str = Field(max_length=12000)
    answer: str = Field(max_length=20000)


class AskRequest(BaseModel):
    user_id: str
    question: str = Field(min_length=1, max_length=12000)   # room for pasted code or a design doc
    agent: Literal["expert", "code_review", "security", "threat_model", "compliance"] = "expert"
    image: str | None = Field(default=None, max_length=12_000_000)   # data URL of a diagram (Threat Modeler)
    domain: str | None = Field(default=None, max_length=64)           # Domain Expert: which domain to answer in
    language: str | None = Field(default=None, max_length=8)          # "auto" or a code from /api/languages
    history: list[HistoryTurn] = Field(default_factory=list, max_length=20)  # earlier turns of this chat, oldest first


class RedTeamRequest(BaseModel):
    user_id: str
    focus: str = Field(default="", max_length=500)
    generated: int = Field(default=3, ge=0, le=6)


IMAGE_TYPES = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}


def save_chat_image(data_url: str) -> Path:
    m = re.fullmatch(r"data:(image/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)", data_url)
    if not m:
        raise HTTPException(400, "image must be a PNG, JPEG or WEBP data URL")
    raw = base64.b64decode(m.group(2))
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(413, "image larger than 8 MB")
    folder = settings.data_dir / "chat_images"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{hashlib.sha256(raw).hexdigest()[:24]}{IMAGE_TYPES[m.group(1)]}"
    if not path.exists():
        path.write_bytes(raw)
    return path


class DefenceRequest(BaseModel):
    enabled: bool


@app.get("/api/health")
def health():
    try:
        chunks, qdrant_ok = store().count(), True
    except Exception:
        chunks, qdrant_ok = 0, False
    return {"ok": qdrant_ok, "qdrant": qdrant_ok, "chunks": chunks, "models_loaded": service.cache_info().currsize > 0,
            "endpoint_label": settings.mode_label, "model": settings.llm.model}


@app.get("/api/users")
def users():
    return [asdict(u) for u in load_users().values()]


@app.get("/api/settings")
def get_settings():
    return {"injection_defence": _state["injection_defence"], "endpoint_label": settings.mode_label,
            "model": settings.llm.model, "reasoning_effort": settings.llm.reasoning_effort}


@app.post("/api/settings/injection-defence")
def set_defence(req: DefenceRequest):
    _state["injection_defence"] = req.enabled
    return {"injection_defence": req.enabled}


@app.post("/api/ask")
def ask(req: AskRequest):
    user = load_users().get(req.user_id)
    if not user:
        raise HTTPException(404, "unknown user")
    image = save_chat_image(req.image) if req.image else None
    domain = None
    if req.agent == "expert" and req.domain:
        domain = load_domains().get(req.domain)
        if not domain:
            raise HTTPException(404, "unknown domain")
    if req.language and req.language != "auto" and req.language not in LANGUAGES:
        raise HTTPException(400, "unsupported language")
    ans = service().ask(user, req.question.strip(), defence=_state["injection_defence"], agent=req.agent, image=image,
                        domain=domain["id"] if domain else None, domain_name=domain["name"] if domain else None,
                        language=req.language, history=[(t.question, t.answer) for t in req.history])
    return asdict(ans)


@app.post("/api/redteam")
def red_team(req: RedTeamRequest):
    from app.redteam import RedTeam
    user = load_users().get(req.user_id)
    if not user:
        raise HTTPException(404, "unknown user")
    team = RedTeam(service(), LLMClient(settings.llm), registry())

    def events():
        try:
            for ev in team.run(user, focus=req.focus, generated=req.generated):
                yield json.dumps(ev, ensure_ascii=False) + "\n"
        except Exception as e:
            yield json.dumps({"step": "error", "message": f"{type(e).__name__}: {e}"}) + "\n"

    return StreamingResponse(events(), media_type="application/x-ndjson")


@app.get("/api/languages")
def languages():
    return [{"code": l.code, "name": l.name, "native": l.native} for l in LANGUAGES.values()]


@app.get("/api/agents")
def agents():
    return [{"id": a.id, "name": a.name, "tagline": a.tagline, "kind": a.kind, "reads_diagram": a.reads_diagram}
            for a in AGENTS.values() if a.listed]


SAMPLES_DIR = ROOT / "test_docs" / "domains"


def load_domains() -> dict[str, dict]:
    data = yaml.safe_load((ROOT / "config" / "domains.yaml").read_text())
    return {d["id"]: d for d in data["domains"]}


@app.get("/api/domains")
def domains():
    reg = registry()
    out = []
    for d in load_domains().values():
        docs = [v["title"] for v in reg.values() if v.get("domain") == d["id"]]
        samples = sorted(p.name for p in (SAMPLES_DIR / d["id"]).glob("*.pdf")) if (SAMPLES_DIR / d["id"]).exists() else []
        out.append({**d, "documents": sorted(docs), "samples": samples})
    return out


@app.post("/api/domains/{domain_id}/load-samples")
def load_samples(domain_id: str):
    """Index the sample foundation documents for one domain (test_docs/domains/<id>/*.pdf)."""
    import shutil
    from ingest.loader import ACL, load_doc, load_titles
    from ingest.pipeline import Ingestor
    if domain_id not in load_domains():
        raise HTTPException(404, "unknown domain")
    files = sorted((SAMPLES_DIR / domain_id).glob("*.pdf"))
    if not files:
        raise HTTPException(404, "no sample documents for this domain")
    ingestor = Ingestor(settings, embedder(), store(), vision())
    acl, titles = ACL.load(settings.corpus_dir / "acl.yaml"), load_titles(settings.corpus_dir)

    def events():
        with _ingest_lock:
            for src in files:
                target = settings.corpus_dir / "uploads" / domain_id / src.name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(src, target)
                doc = load_doc(target, settings.corpus_dir, acl, titles)
                try:
                    for ev in ingestor.ingest_doc(doc):
                        yield json.dumps({**ev, "file": src.name}, ensure_ascii=False) + "\n"
                except Exception as e:
                    yield json.dumps({"step": "error", "file": src.name, "message": f"{type(e).__name__}: {e}"}) + "\n"
            yield json.dumps({"step": "done", "files": len(files)}) + "\n"

    return StreamingResponse(events(), media_type="application/x-ndjson")


@app.get("/api/documents")
def documents():
    return [{"doc_id": k, **{f: v[f] for f in ("title", "rel_path", "pages", "source_types", "chunks")},
             "domain": v.get("domain", "general"), "quarantined": v["quarantined"]}
            for k, v in sorted(registry().items(), key=lambda kv: kv[1]["title"].lower())]


@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: str):
    import shutil
    from ingest.pipeline import Registry
    reg = registry()
    if not re.fullmatch(r"[a-z0-9-]+", doc_id) or doc_id not in reg:
        raise HTTPException(404, "not found")
    with _ingest_lock:
        store().delete_doc(doc_id)
        source = (settings.corpus_dir / reg[doc_id]["rel_path"]).resolve()
        if source.is_relative_to(settings.corpus_dir.resolve()) and source.exists():
            source.unlink()
        shutil.rmtree(settings.data_dir / "pages" / doc_id, ignore_errors=True)
        Registry(settings.data_dir / "docs.json").remove(doc_id)
    return {"deleted": doc_id}


@app.get("/api/docs")
def docs(user_id: str):
    user = load_users().get(user_id)
    if not user:
        raise HTTPException(404, "unknown user")
    return [{"doc_id": k, **{f: v[f] for f in ("title", "rel_path", "pages", "source_types", "acl_groups", "chunks")},
             "quarantined": len(v["quarantined"])}
            for k, v in registry().items() if set(v["acl_groups"]) & set(user.groups)]


def _doc_for(doc_id: str, user_id: str) -> dict:
    user = load_users().get(user_id)
    doc = registry().get(doc_id)
    # Same answer for "missing" and "forbidden" so the API does not leak which documents exist.
    if not user or not doc or not set(doc["acl_groups"]) & set(user.groups):
        raise HTTPException(404, "not found")
    return doc


@app.get("/api/docs/{doc_id}/page/{n}")
def page_image(doc_id: str, n: int, user_id: str):
    _doc_for(doc_id, user_id)
    path = settings.data_dir / "pages" / doc_id / f"{n}.png"
    if not re.fullmatch(r"[a-z0-9-]+", doc_id) or not path.exists():
        raise HTTPException(404, "not found")
    return FileResponse(path, media_type="image/png")


@app.get("/api/docs/{doc_id}/quarantine")
def quarantine(doc_id: str, user_id: str):
    return _doc_for(doc_id, user_id)["quarantined"]


@app.get("/api/audit")
def audit_log(limit: int = 100):
    return audit().recent(limit)


@app.get("/api/about")
def about():
    return {
        "model": settings.llm.model,
        "family": "GLM-5.3-Flash",
        "parameters": "320B total (mixture of experts)",
        "weights": "Open weights",
        "licence": "MIT",
        "quantization": settings.quant_label or "Not specified",
        "running_on": settings.mode_label,
        "endpoint": settings.llm.base_url,
        "reasoning_effort": settings.llm.reasoning_effort,
        "embeddings": "BAAI/bge-m3 (local)",
        "reranker": "BAAI/bge-reranker-v2-m3 (local)",
        "vector_store": "Qdrant (local)",
    }


INGEST_FOLDERS = {"uploads"}
UPLOAD_EXT = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}


@app.post("/api/ingest")
async def live_ingest(file: UploadFile = File(...), folder: str = Form("uploads"), domain: str = Form("")):
    from ingest.loader import ACL, load_doc, load_titles
    from ingest.pipeline import Ingestor

    name = Path(file.filename or "").name
    if folder not in INGEST_FOLDERS or Path(name).suffix.lower() not in UPLOAD_EXT:
        raise HTTPException(400, "unsupported folder or file type")
    if domain and domain not in load_domains():
        raise HTTPException(400, "unknown domain")
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    target = settings.corpus_dir / folder / (domain or "") / safe
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(await file.read())

    doc = load_doc(target, settings.corpus_dir, ACL.load(settings.corpus_dir / "acl.yaml"), load_titles(settings.corpus_dir))
    ingestor = Ingestor(settings, embedder(), store(), vision())

    def events():
        with _ingest_lock:
            try:
                for ev in ingestor.ingest_doc(doc):
                    yield json.dumps(ev, ensure_ascii=False) + "\n"
            except Exception as e:
                yield json.dumps({"step": "error", "message": f"{type(e).__name__}: {e}"}) + "\n"

    return StreamingResponse(events(), media_type="application/x-ndjson")


# Built UI is served from the same origin in production (no CDN, no external fonts).
_dist = ROOT / "ui" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="ui")
