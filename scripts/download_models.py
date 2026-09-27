"""One-time model download. Run with internet; runtime is offline (HF_HUB_OFFLINE=1)."""
import os
from pathlib import Path

os.environ["HF_HUB_OFFLINE"] = "0"
from huggingface_hub import snapshot_download  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MODELS = {"bge-m3": "BAAI/bge-m3", "bge-reranker-v2-m3": "BAAI/bge-reranker-v2-m3"}

for folder, repo in MODELS.items():
    target = ROOT / "models" / folder
    print(f"Downloading {repo} -> {target}")
    snapshot_download(repo, local_dir=target, ignore_patterns=["onnx/*"], allow_patterns=["*.json", "*.safetensors", "pytorch_model.bin", "*.model", "*.txt", "sentencepiece*", "tokenizer*", "1_Pooling/*", "colbert_linear.pt", "sparse_linear.pt"])
print("done")
