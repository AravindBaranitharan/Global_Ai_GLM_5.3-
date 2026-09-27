"""Phase 1: transcribe every image in a folder and write a side-by-side review sheet for hand scoring.

    python -m ops.phase1.probe_vision corpus/tamil corpus/finance
Output: data/phase1/vision_review.md (score each 1-5 by hand).
"""
import sys
import time
from pathlib import Path

from app.config import load_settings
from app.llm.client import LLMClient
from ingest.vision import VisionTranscriber

EXT = {".png", ".jpg", ".jpeg", ".webp"}
s = load_settings()
t = VisionTranscriber(LLMClient(s.vision), s.data_dir / "cache" / "vision")
out = s.data_dir / "phase1" / "vision_review.md"
out.parent.mkdir(parents=True, exist_ok=True)
images = [p for d in sys.argv[1:] or ["corpus"] for p in sorted(Path(d).rglob("*")) if p.suffix.lower() in EXT]
lines = ["# Vision transcription review", "", f"Model: `{s.vision.model}` at `{s.vision.base_url}`", "",
         "Score each 1 (unusable) to 5 (perfect). Check numbers, table structure, Tamil spelling.", ""]
for img in images:
    start = time.perf_counter()
    try:
        text, cached = t.transcribe(img)
        took = f"{(time.perf_counter() - start):.1f}s{' (cached)' if cached else ''}"
    except Exception as e:
        text, took = f"ERROR: {e}", "-"
    print(f"{img}  {took}")
    lines += [f"## {img}", "", f"![]({img.resolve()})", "", f"Time: {took}  |  **Score: _ /5**  |  Notes:", "", "```", text, "```", ""]
out.write_text("\n".join(lines))
print(f"\nReview sheet: {out}")
