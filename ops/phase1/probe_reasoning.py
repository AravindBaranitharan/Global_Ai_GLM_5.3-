"""Phase 1: does reasoning_effort work, and what does it cost in latency? Streams to measure time to first token.

    python -m ops.phase1.probe_reasoning --runs 3 --efforts low,high
"""
import argparse
import statistics
import time

from openai import OpenAI

from app.config import load_settings

PROMPT = [
    {"role": "system", "content": "Answer only from the sources. Cite like [S1]. If not present reply NOT_FOUND."},
    {"role": "user", "content": "Sources:\n<source id=\"S1\">Casual leave: 12 days per year, max 3 consecutive days. "
                                "Earned leave: 18 days, carry forward up to 30.</source>\n\nQuestion: How much casual leave do I get, and can I take 5 days in a row?"},
]

ap = argparse.ArgumentParser()
ap.add_argument("--runs", type=int, default=3)
ap.add_argument("--efforts", default="low,high")
args = ap.parse_args()
s = load_settings()
client = OpenAI(base_url=s.llm.base_url, api_key=s.llm.api_key, timeout=300)

rows = []
for effort in args.efforts.split(","):
    ttfts, totals, toks = [], [], []
    for _ in range(args.runs):
        start = time.perf_counter()
        first, n_chunks, usage, text = None, 0, None, ""
        stream = client.chat.completions.create(model=s.llm.model, messages=PROMPT, stream=True, max_tokens=800,
                                                stream_options={"include_usage": True},
                                                extra_body={"reasoning_effort": effort})
        for ev in stream:
            if ev.usage:
                usage = ev.usage
            if ev.choices and ev.choices[0].delta and ev.choices[0].delta.content:
                first = first or time.perf_counter()
                text += ev.choices[0].delta.content
                n_chunks += 1
        end = time.perf_counter()
        ttfts.append(((first or end) - start) * 1000)
        totals.append((end - start) * 1000)
        out_tokens = usage.completion_tokens if usage else n_chunks
        toks.append(out_tokens / max(end - (first or start), 1e-3))
        print(f"{effort:5} ttft={ttfts[-1]:.0f}ms total={totals[-1]:.0f}ms out_tokens={out_tokens} | {text[:70]!r}")
    rows.append((effort, statistics.median(ttfts), statistics.median(totals), statistics.median(toks)))

print("\n| reasoning_effort | median TTFT (ms) | median total (ms) | output tok/s |\n|---|---|---|---|")
for effort, ttft, total, tps in rows:
    print(f"| {effort} | {ttft:.0f} | {total:.0f} | {tps:.1f} |")
print("\nIf low and high look identical, the endpoint may be ignoring reasoning_effort: record that in DECISIONS.md.")
