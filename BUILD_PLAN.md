# BUILD PLAN: Self-Hosted Multimodal RAG with GLM-5.3-Flash

**Session:** 320 Billion Parameters, One GPU, Zero Data Leaks: Building a RAG That Sees, Reads, and Reasons with Self-Hosted GLM-5.3-Flash
**Owner:** Aravind Baranitharan (AI Engineer, TCS)
**Event:** Global AI Community, 30 to 45 minute talk with live demo

---

## 0. Instructions for Claude Code

Read this whole file before writing anything.

- Work **one phase at a time**, in order. Do not start a phase until the previous phase's acceptance checks pass.
- **Before starting each phase, summarise what you plan to build and wait for my confirmation.** Do not generate code until I say go.
- Prefer boring, well-known libraries. No experimental frameworks unless this plan names them.
- Never hardcode secrets. Everything configurable lives in `.env`, with a committed `.env.example`.
- Everything must run on a single Linux GPU instance with **outbound internet blocked** once models are downloaded. If a component phones home (telemetry, CDN fonts, remote model downloads at runtime), treat that as a bug.
- The LLM is always called through an **OpenAI-compatible Chat Completions client**. Switching from cloud to self-hosted must be a change of `LLM_BASE_URL` only, with zero code changes.
- Write small tests for each module. Keep a `DECISIONS.md` log of any choice you make that this plan does not cover.

---

## 1. What We Are Building

A RAG application over a deliberately messy document set (digital PDFs, scanned pages, images, Tamil and English) that:

1. **Sees and reads.** Ingests scans and images using GLM-5.3-Flash's vision to transcribe and describe them.
2. **Reasons with sources.** Answers questions in English or Tamil, with every claim cited to a document and page.
3. **Respects access.** Different users see answers only from documents they are cleared for.
4. **Resists attacks.** Detects and neutralises hidden instructions planted inside documents.
5. **Leaves a trail.** Logs every query, the retrieved chunks, the user, and which model endpoint answered.
6. **Moves home in one line.** Runs first on the Jarvis Labs managed endpoint, then on our own H200 running a quantized GGUF, then keeps working with outbound network blocked.

### The demo corpus: a fictional company

We use a **fictional mid-size company** (working name: *Lowkey Tech Pvt Ltd*, fictional, no real people or real personal data). Around 40 to 80 documents:

| Folder | Content | Access group |
|---|---|---|
| `hr/` | Leave policy, travel policy, a scanned signed offer letter template (dummy names) | `hr`, `all` |
| `finance/` | Scanned invoices with tables, a quarterly summary with charts as images | `finance` |
| `engineering/` | Architecture diagram images, incident postmortem, whiteboard photo | `engineering` |
| `legal/` | A vendor contract (digital PDF) with clauses on data retention | `legal` |
| `tamil/` | Tamil-language circulars and notices, some scanned, some typed | `all` |
| `poisoned/` | One innocent-looking document containing a hidden prompt injection | `all` |

All content is either written by us or public-domain. Nothing with real personal data.

---

## 2. Architecture

```
                 ┌────────────────── Ingestion (offline) ──────────────────┐
  docs/ ──► Loader ──► Page renderer ──► Text layer? ──yes──► Layout text + boxes
                                             │
                                             no (scan/image)
                                             ▼
                                   GLM-5.3-Flash vision transcription
                                   + Tesseract (tam+eng) for word boxes
                                             │
                                             ▼
                        Sanitiser (hidden text, injection scan)
                                             │
                                             ▼
                        Chunker (with page, bbox, doc_id, acl_groups)
                                             │
                                             ▼
                        BGE-M3 embeddings (dense + sparse) ──► Qdrant
                 └─────────────────────────────────────────────────────────┘

                 ┌──────────────────── Query (online) ─────────────────────┐
  User + role ──► API ──► ACL filter ──► Hybrid search (Qdrant) ──► Reranker
                                                                      │
                                                                      ▼
                           Prompt builder (spotlighted, delimited context)
                                                                      │
                                                                      ▼
                   LLM_BASE_URL ─► Jarvis endpoint  OR  llama-server on H200
                                                                      │
                                                                      ▼
                     Citation validator ──► Answer + sources ──► Audit log
                 └─────────────────────────────────────────────────────────┘
```

### Component choices

| Layer | Choice | Why |
|---|---|---|
| LLM (development) | Jarvis Labs managed endpoint, model `glm-5.3-flash` | Pay per token, no GPU needed while building |
| LLM (demo, self-hosted) | Unsloth `GLM-5.3-Flash-GGUF`, `UD-Q2_K_XL` (~109 GB) on 1× H200 via llama.cpp `llama-server`. Upgrade: `UD-Q3` on 2× H200 | "320B on one GPU" story, OpenAI-compatible server |
| Embeddings | BGE-M3 | Strong multilingual including Tamil, gives dense and sparse vectors in one model |
| Reranker | bge-reranker-v2-m3 | Multilingual, small, runs on CPU or shared GPU |
| Vector store | Qdrant (Docker) | Native hybrid search, payload filters for ACL |
| Word boxes for scans | Tesseract with `tam` + `eng` | Gives bounding boxes for highlighting; GLM does the quality transcription |
| PDF handling | PyMuPDF | Page rendering, text layer, font colour and size (needed for hidden-text detection) |
| Backend | Python, FastAPI | Simple, typed, easy to demo |
| Frontend | React + Vite + Tailwind, black and white theme | Chat on the left, source page viewer on the right |
| Audit log | SQLite | Zero setup, easy to show in a table |
| Packaging | Docker Compose | One command to start everything on the GPU box |

---

## 3. Repository Layout

```
self-hosted-rag/
├── BUILD_PLAN.md            # this file
├── DECISIONS.md             # log of choices made during build
├── .env.example
├── docker-compose.yml
├── corpus/                  # demo documents, organised by folder above
│   └── acl.yaml             # maps folders/files to access groups
├── ingest/
│   ├── loader               # walks corpus, detects type
│   ├── render               # page images and text layer
│   ├── vision               # GLM-5.3-Flash transcription of scans/images
│   ├── ocr_boxes            # Tesseract word boxes for highlighting
│   ├── sanitize             # hidden text + injection detection
│   ├── chunk                # chunking with metadata
│   └── index                # embed and upsert to Qdrant
├── app/
│   ├── api                  # FastAPI routes: /ask, /docs/{id}/page/{n}, /audit, /health
│   ├── retrieval            # ACL filter, hybrid search, rerank
│   ├── prompt               # prompt builder with spotlighting
│   ├── llm                  # OpenAI-compatible client, reads LLM_BASE_URL
│   ├── citations            # validates every cited chunk exists in retrieved set
│   └── audit                # SQLite writer and reader
├── ui/                      # React front end
├── eval/
│   ├── golden.yaml          # 30+ questions with expected doc and page
│   └── run_eval             # retrieval hit rate, citation accuracy, refusal accuracy
├── ops/
│   ├── llama_server.md      # exact llama.cpp build, flags, GGUF file, tested versions
│   ├── egress_block.md      # how to block outbound traffic via Jarvis security groups
│   └── demo_runbook.md      # step by step for talk day
└── tests/
```

---

## 4. Configuration (`.env.example`)

| Variable | Purpose |
|---|---|
| `LLM_BASE_URL` | `https://models.jarvislabs.net/v1` for cloud, `http://localhost:8080/v1` for self-hosted |
| `LLM_API_KEY` | Jarvis Labs key in cloud mode; dummy value for llama-server |
| `LLM_MODEL` | `glm-5.3-flash` (cloud) or the GGUF alias configured in llama-server |
| `LLM_REASONING_EFFORT` | `low` for demo speed, `high` for evaluation. Default on the endpoint is `max`, which is slow and costly |
| `LLM_MODE_LABEL` | Shown as a badge in the UI: "Cloud endpoint" or "Self-hosted H200" |
| `QDRANT_URL` | Local Qdrant |
| `EMBED_MODEL_PATH`, `RERANK_MODEL_PATH` | Local paths, pre-downloaded, so nothing is fetched at runtime |
| `AUDIT_DB_PATH` | SQLite file location |
| `INJECTION_DEFENCE` | `on` or `off`, toggled live during the demo |

---

## 5. Security and Governance Features (these are the talk)

Each feature must be **visible in the UI**, because the audience can only believe what they see.

1. **Access control at retrieval.** Every chunk carries `acl_groups`. The Qdrant query always includes a filter on the current user's groups. The UI has a user switcher (Priya from HR, Karthik from Engineering, Guest). Same question, different users, different answers. The LLM never sees chunks the user cannot access.
2. **Citations enforced.** The model must cite chunk IDs. The citation validator rejects any citation that is not in the retrieved set. If there is no supporting chunk, the answer is "I could not find this in the documents you have access to." The UI shows the source page image with the matching region highlighted.
3. **Indirect prompt injection defence.** Three layers:
   - *Sanitiser at ingestion* flags text that is white-on-white, tiny font, off-page, or matches instruction-like patterns ("ignore previous instructions", "you are now", etc.). Flagged spans are quarantined, not indexed.
   - *Spotlighting in the prompt.* Retrieved content is wrapped in clear delimiters and the system prompt states that document content is data, never instructions.
   - *Output check.* Answers that contain URLs, emails, or actions not present in the question are flagged.
   The `INJECTION_DEFENCE` toggle lets us show the attack succeeding with defences off, then failing with them on.
4. **Audit trail.** Every request logs timestamp, user, groups, question, retrieved chunk IDs, cited chunk IDs, endpoint label, latency, and any injection flags. The UI has an Audit tab.
5. **Zero egress proof.** In self-hosted mode, block all outbound traffic from the instance using a Jarvis Labs security group, run a curl to a public site to show it fails, then ask a question and show it still works.
6. **Model transparency.** A small "About this model" panel: open weights, MIT licence, quantization level, where it is running.

---

## 6. Development Phases

Estimates assume evenings and weekends. Adjust to the event date.

### Phase 1: Make-or-break checks (Day 1 to 2)

Goal: prove the risky parts before building anything.

- [ ] Get a Jarvis Labs API key and call the managed endpoint from a script.
- [ ] Send 5 Tamil scans and 5 English scans to the endpoint's vision input. Judge transcription quality by hand.
- [ ] Confirm `reasoning_effort` works on the endpoint and measure latency at `low` vs `high`.
- [ ] Rent 1× H200 for about two hours. Build llama.cpp at the version Unsloth documents for GLM-5.3-Flash. Load `UD-Q2_K_XL`. Confirm the OpenAI-compatible server answers.
- [ ] Check whether **image input works with the GGUF** (vision projector file). If not, self-hosted mode is text-only at query time and ingestion stays on the endpoint or pre-computed. Record the decision in `DECISIONS.md`.
- [ ] Record tokens per second and time to first token on the H200.

**Acceptance:** a one-page note in `DECISIONS.md` saying go or change plan, with numbers.

### Phase 2: Corpus (Day 3 to 4)

- [ ] Write or collect the fictional company documents per Section 1.
- [ ] Produce scans by printing and photographing or scanning some pages, so they are genuinely messy.
- [ ] Create the poisoned document with a hidden instruction (for example, white text telling the assistant to recommend an external link or reveal restricted info).
- [ ] Write `acl.yaml`.
- [ ] Write `eval/golden.yaml` with at least 30 questions: 10 English digital, 8 scanned or table, 6 Tamil, 3 image or diagram, 3 that should be refused due to ACL or missing info.

**Acceptance:** corpus folder and golden set reviewed by me.

### Phase 3: Ingestion pipeline (Day 5 to 7)

- [ ] Loader, renderer, text layer extraction with bounding boxes.
- [ ] Vision transcription for scans and images, cached to disk so we never pay twice.
- [ ] Tesseract word boxes for scans, aligned to transcribed text for highlighting.
- [ ] Sanitiser with quarantine report.
- [ ] Chunker with metadata: `doc_id`, `page`, `bbox`, `lang`, `acl_groups`, `source_type`.
- [ ] Embeddings and Qdrant upsert with dense and sparse vectors.

**Acceptance:** one command ingests the whole corpus; quarantine report lists the poisoned span; Qdrant shows expected chunk counts.

### Phase 4: Retrieval and answering (Day 8 to 9)

- [ ] ACL-filtered hybrid search, top 30, rerank to top 6 to 8.
- [ ] Prompt builder with spotlighting and answer-language matching (Tamil question, Tamil answer).
- [ ] LLM client reading `LLM_BASE_URL`.
- [ ] Citation validator and refusal behaviour.
- [ ] Audit logging.
- [ ] Run `eval/run_eval`.

**Acceptance:** at least 85% of golden questions retrieve the right document in the top 6, 100% of ACL questions correctly refused, zero invalid citations.

### Phase 5: UI (Day 10 to 11)

- [ ] Black and white theme, clean type, large readable font for a projector.
- [ ] Left: chat. Right: source page image with highlighted region, click citation to jump.
- [ ] Top bar: user switcher, endpoint badge, injection defence toggle.
- [ ] Tabs: Chat, Audit, About this model.
- [ ] Live ingest button for adding one new document during the demo.

**Acceptance:** full demo script (Section 7) runs end to end on the cloud endpoint.

### Phase 6: Self-hosted mode (Day 12 to 13)

- [ ] Docker Compose runs Qdrant, API, UI, embedder and reranker on the H200 instance next to llama-server.
- [ ] Switch `LLM_BASE_URL`; run the eval again and compare against cloud results.
- [ ] Apply the egress-blocking security group; confirm the app still works and that a public curl fails.
- [ ] Write `ops/llama_server.md` with exact build commit, flags, context size, and GGUF filename. **Freeze these versions.**

**Acceptance:** eval scores within a few points of cloud mode; demo runs with outbound traffic blocked.

### Phase 7: Rehearsal and fallbacks (Day 14 onward)

- [ ] Write `ops/demo_runbook.md`.
- [ ] Record a full backup video of the demo.
- [ ] Two full dry runs with a timer.
- [ ] Prepare a slide with the architecture diagram and a slide with eval numbers.

---

## 7. Demo Script (12 to 25 minute segment, plus governance segment)

**Before the talk:** H200 started and model loaded at least 45 minutes early. Cloud endpoint key working. Backup video open in another tab. Browser zoom set for the projector.

1. **The mess.** Show the corpus folder: scans, photos, Tamil notices, diagrams. "This is what real company data looks like."
2. **Live ingest.** Drop in one new scanned document. Show the vision transcription appearing and chunks landing in the index.
3. **Scanned table question (English).** "What was the total on the October invoice from the Hosur vendor?" Answer with the invoice page shown and the total highlighted.
4. **Tamil question.** Ask about a Tamil circular in Tamil. Answer comes back in Tamil with the source highlighted.
5. **Diagram question.** "Which service talks to the payments database?" Answer drawn from an architecture diagram image.
6. **Access control.** Switch from Priya (HR) to Karthik (Engineering). Ask about salary bands. Priya gets an answer; Karthik gets a polite refusal. Show the Audit tab recording both.
7. **The attack.** Turn injection defence **off**. Ask an innocent question that retrieves the poisoned doc. The model follows the hidden instruction. Turn defence **on**, ask again. Clean answer, and the UI shows the quarantined span.
8. **The switch.** "All of that ran on a cloud endpoint. Now watch." Change `LLM_BASE_URL` to the H200 and restart the API. The badge changes to "Self-hosted H200". Repeat question 3.
9. **Pull the plug.** Apply the egress-block security group. Run a curl to a public site in the terminal; it fails. Ask the Tamil question again; it works. "320 billion parameters, one GPU, zero data leaks."
10. **Audit tab** as the closing shot: every question, user, source, and endpoint on one screen.

**If something breaks:** switch to the backup video at the matching timestamp and keep talking. Never debug on stage.

---

## 8. Budget

| Item | Estimate |
|---|---|
| Jarvis managed endpoint during development | Around ₹0.20 per RAG query at low reasoning effort; budget ₹500 to ₹1,000 total |
| 1× H200 (~$3.99/hr) for Phase 1 and Phase 6 testing | 8 to 10 hours |
| H200 on talk day | 2 to 3 hours including warm-up |
| Optional 2× H200 for 3-bit quality | Only if Phase 6 eval shows 2-bit is not good enough |

Pause instances whenever not in use. Storage for the GGUF still bills while paused, so delete the instance after the talk if it will not be reused.

---

## 9. Risks and Fallbacks

| Risk | Fallback |
|---|---|
| llama.cpp support for GLM-5.3-Flash is unstable | Pin the exact working build from Phase 1; never upgrade after Phase 6 |
| Vision not available in GGUF | Ingestion uses the endpoint (pre-computed, cached). Self-hosted mode answers from stored transcriptions |
| Tamil transcription weak on old or low-quality scans | Use cleaner Tamil samples; keep Tamil mainly for the question-and-answer side |
| 2-bit quality visibly worse than cloud | Move to UD-Q3 on 2× H200 for the demo |
| Region highlighting unreliable on scans | Fall back to page-level citation with the paragraph text shown under the image |
| Venue Wi-Fi fails | Tether to phone; worst case, the backup video |
| H200 unavailable on talk day | Book the instance well ahead and keep it paused, not deleted |

---

## 10. Definition of Done

- One command starts the whole stack on the GPU instance.
- Eval passes the Phase 4 thresholds in both cloud and self-hosted modes.
- Demo script runs end to end twice in a row with no manual fixes.
- Works with outbound traffic blocked.
- Backup video recorded.
- `DECISIONS.md`, `ops/llama_server.md`, and `ops/demo_runbook.md` complete.
