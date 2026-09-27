"""BGE-M3 (dense + sparse) and bge-reranker-v2-m3, loaded from local paths only."""
from __future__ import annotations

import threading
from dataclasses import dataclass
from pathlib import Path

# The embedder and reranker share one accelerator (Metal on a Mac, CUDA on the GPU box). PyTorch
# inference on it is not safe from several threads at once: concurrent requests crashed the server
# with a Metal command-buffer assertion. Each call takes ~100 ms, so serialising them is cheap;
# the slow part (the LLM call) still runs in parallel.
MODEL_LOCK = threading.Lock()


@dataclass
class Encoded:
    dense: list[float]
    sparse_indices: list[int]
    sparse_values: list[float]


def _check(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"Model not found at {path}. Run: python scripts/download_models.py")
    return str(path)


class Embedder:
    dim = 1024

    def __init__(self, path: Path):
        from FlagEmbedding import BGEM3FlagModel
        self.model = BGEM3FlagModel(_check(path), use_fp16=False)

    def encode(self, texts: list[str], batch_size: int = 8) -> list[Encoded]:
        with MODEL_LOCK:
            out = self.model.encode(texts, batch_size=batch_size, max_length=1024, return_dense=True, return_sparse=True)
        results = []
        for dense, weights in zip(out["dense_vecs"], out["lexical_weights"]):
            items = [(int(k), float(v)) for k, v in weights.items() if float(v) > 0]
            results.append(Encoded(
                dense=[float(x) for x in dense],
                sparse_indices=[k for k, _ in items],
                sparse_values=[v for _, v in items],
            ))
        return results


class Reranker:
    # Half precision and 512-token inputs: 3.9 s -> 1.1 s per question on the Mac GPU with the same
    # top-3 ranking on the test questions (benchmark in DECISIONS.md). RERANK_FP16=0 turns it off.
    MAX_LENGTH = 512

    def __init__(self, path: Path, fp16: bool = True):
        from FlagEmbedding import FlagReranker
        self.model = FlagReranker(_check(path), use_fp16=fp16)

    def score(self, query: str, passages: list[str]) -> list[float]:
        if not passages:
            return []
        with MODEL_LOCK:
            scores = self.model.compute_score([[query, p] for p in passages], normalize=True, max_length=self.MAX_LENGTH)
        return [float(s) for s in (scores if isinstance(scores, list) else [scores])]
