# Decisions

Choices made during the build that BUILD_PLAN.md does not cover, plus Phase 1 results.

## Phase 1 results (2026-09-24, Jarvis Labs managed endpoint)

| Check | Result |
|---|---|
| Endpoint | `https://models.jarvislabs.net/v1`, model `glm-5.3-flash`, Bearer key. OpenAI SDK works unchanged. |
| Text call | 3.5 s cold, correct English + Tamil output |
| `reasoning_effort` | Accepted without error, but **no measurable effect**: low = 1.4 s TTFT / 1.7 s total, high = 1.2 s / 1.5 s, identical answers. Treat as ignored by the endpoint. |
| Output speed | ~140–160 tokens/s |
| Vision, English scans | Excellent. Hosur invoice table transcribed perfectly, including ₹ amounts and GST rows. |
| Vision, diagram | Good. One wrong edge (said API Gateway → Notification Service; the diagram shows Kafka → Notification Service). |
| Vision, Tamil | Clean pages near perfect; synthetic noisy scan has word errors (ஓசூர் → ஒருர், தலைக்கவசம் → தளக்கவசம், ஃபோர்க்லிஃப்ட் → லோரர்களிடம்). Numbers survive. "Hosur" (ஓசூர்) is misread on every Tamil page. |
| Full eval (cloud, 35 questions) | hit@6 30/30, page hit 30/30, refusals 4/4, citation accuracy 30/30, answer checks 30/30, invalid citations 0, median LLM latency 1.9 s. |
| Self-hosted H200 | **Not tested.** The user chose the managed endpoint for now; Phase 1 GPU checks deferred. |

**Decision: go** on the managed endpoint. Keep Tamil mainly on the question/answer side as the plan's fallback suggests, and prefer clean Tamil scans on stage.

## Build decisions

- **Company renamed** from Kaveri Logistics to **Lowkey Tech Pvt Ltd** (user request).
- **Repo root** is this folder, not a `self-hosted-rag/` subfolder.
- **Synthetic scans.** `scripts/make_corpus.py` renders pages and degrades them (rotation, noise, blur, JPEG). They are cleaner than real phone photos; add genuinely printed-and-photographed pages before the talk.
- **Corpus size** is 17 documents, below the plan's 40–80. Enough for the golden set; grow it with real scans.
- **Tamil PDFs are routed to vision.** PyMuPDF's text layer for shaped Tamil extracts as garbage (glyph mapping). `ingest/render.py::text_layer_broken` detects this and treats the page as a scan.
- **Digital pages with large images** (≥12% of the page) also get a vision pass; only its `DESCRIPTION:` section is indexed, so chart values become searchable.
- **Quarantined text is indexed but filtered.** The plan says "quarantined, not indexed"; we index it with `quarantined: true` and exclude it in the Qdrant filter while defence is on. This is what lets the live toggle show the attack.
- **Citation labels.** The model cites short labels `[S1]`, mapped server-side to chunk IDs. Short labels are far more reliable than UUIDs.
- **Refusal sentinel.** The model replies `NOT_FOUND`; the server swaps in the fixed refusal text in the question's language. Answers with no valid citation are refused too.
- **No hits → no LLM call.** If ACL filtering plus the reranker threshold (0.02) leaves nothing, we refuse without calling the model. Guarantees ACL refusals and saves cost.
- **Output check** flags URLs, emails and phone numbers not in the question; with defence on it also redacts them.
- **Non-streaming answers** for now, so citations can be validated before anything is shown.
- **Users** live in `config/users.yaml` (Priya/HR, Karthik/Engineering, Meena/Finance+Legal, Guest). Groups are resolved server-side; the client sends only `user_id`. Meena was added so finance and legal questions have a cleared user.
- **Page images** are served only to users cleared for the document; "forbidden" and "missing" both return 404.
- **Audit tab is open to all demo users.** In production it would be admin-only.
- **Qdrant pinned** to server v1.12.4 and client 1.12.x, telemetry disabled.
- **Local dev without Compose.** Docker Compose is not installed on the dev Mac; Qdrant runs via `docker run`. `docker-compose.yml` is kept for the GPU box.
- **API port 8010** locally, because another process already uses 8000.
- **Models** are downloaded once by `scripts/download_models.py`; runtime sets `HF_HUB_OFFLINE=1`.

## UI decisions (2026-09-24)

- **Design language (v4, replaces the cream-and-green v3 and the black-and-yellow v2 at the user's request).** A dark ChatGPT-style chat app following the user's fourth design system: near-black canvas #0a0a0a, white outline pills as the only interactive shape (the white-filled pill is kept for the Documents CTA and Send), Inter weight 400 everywhere with tight negative tracking on display sizes, Geist Mono uppercase tracked labels, 8px hairline cards and no shadows. The sunset and dusk accents appear only in illustration: the twinkling star field and horizon arc on empty states, and the gradient rule on a fully blocked Red Team run. The source brand's name is not used. Earlier versions are in `archive/ui-dark-yellow/` and `archive/ui-cream-green/`.
- **Fonts** are bundled (Inter Variable, JetBrains Mono, Noto Sans Tamil via @fontsource), so nothing loads from a CDN.
- **"Show the code" applied to the pipeline.** Each answer carries a run-log card (acl, search, defence, model, verify) with that request's real numbers; the waiting state streams the same stages. The Model tab shows the one-line `.env` switch.
- **Highlights are a yellow highlighter stroke** (`mix-blend-multiply`) on the page; quarantined hidden text is a red box. Pages with quarantined text are shown whole, not zoomed, so the box stays in view.
- **Semantic colours** are drawn from the accent palette so they stay in key: soft green for ok, sunset orange for errors, quarantine and defence off, sunset-soft for flags.
- **Precise highlights.** Each chunk now stores per-line boxes with their text (`lines`). The UI highlights only the lines that carry the answer's facts (numbers weigh most; words from the document title are ignored), falling back to the whole passage.
- **Scan OCR** uses Tesseract `--psm 11` (the default mode dropped ruled table rows such as TOTAL) plus a small-angle skew estimate used only to group words into rows. OCR runs on the original pixels because resampling lost bold text.
- **Document titles** come from `corpus/meta.yaml`.
- **`--cache-only` ingest** never calls the vision endpoint; used for all re-ingests since the user asked to approve every paid call.
- **Page viewer uses the current user**, never the original asker, so switching users cannot reveal a page through an old citation.
- **Answers are not streamed**, so citations are validated before display; a client-side progress list shows the pipeline stages while waiting.
- **Tests:** UI unit/component tests (Vitest) and browser tests (Playwright) run against the real API with `/api/ask` intercepted, so testing never calls the paid endpoint.

## Open question

- **The injection demo does not succeed with defence off.** The poisoned chunk reaches the model (flagged `quarantined_chunk_used`), but GLM-5.3-Flash refuses the password-phishing instruction and warns the user instead. Needs a decision on how to stage the attack.

## Pivot to a domain-specialist assistant (2026-09-24, user request)

- **Use case changed** from a company HR/finance document assistant to a domain-specialist RAG: users upload technical PDFs (standards, API specs, runbooks) and three agents answer from them on GLM-5.3-Flash. The Lowkey Tech corpus, its golden set and the AI-governance test PDF moved to `archive/`.
- **Three agents** (`app/agents.py`) share retrieval and every guardrail (spotlighting, citation validation, output check, audit) but differ in role and format:
  - *Domain Expert*: citations required; refuses without a supporting passage, with no LLM call.
  - *Code Reviewer*: reviews pasted code against the uploaded standards; cites rules it uses and labels other findings "(general practice)", so citations are not mandatory.
  - *Security Agent*: runs a deterministic static scanner first (`app/security_scan.py`), passes its findings to the model inside `<scan>` tags to confirm or dismiss, and returns them to the UI.
- **Single user.** Access groups stay in the backend (uploads are readable by `all`) but the user switcher is gone. The user is shown as "Aravind Baranitharan"; the request said "Arulan", read as dictation of the user's name.
- **Questions up to 12,000 characters** so code can be pasted; retrieval uses the first 2,000.
- **Injection pattern narrowed.** "instructions to the model" produced a false positive on a legitimate security standard; the pattern now needs "note/message to the AI". Regression test added.
- **UI** is a full chat app: left sidebar (agents, chats, workspace, user at the bottom), white Documents pill (upload, list, delete, view quarantined text), no page images. Code in answers renders as code blocks with copy.
- **Race fixed.** A question sent before the user profile loaded stayed pending forever; the composer now waits for the profile and `run()` reports an error instead.
- **Sample domain documents** are generated by `scripts/make_domain_docs.py` into `test_docs/`; the payments guide carries a hidden white-text instruction for the injection demo. The new golden set (13 questions) scores 12/12 retrieval hit@6 in retrieval-only mode.

## Six agents and the live check (2026-09-24 night)

- **New agents:** Threat Modeler (attach a diagram; GLM vision reads it with a diagram prompt, cached; output is a STRIDE table), Compliance Checker (rule-by-rule Pass/Fail/Partial matrix), Red Team (multi-step: 3 built-in seed attacks plus 3 written by GLM, each run with the defence off and on, judged by deterministic success markers). Vision text from an image is wrapped in `<diagram>` tags and injection-checked like any source.
- **Datasets:** `scripts/make_datasets.py` builds `test_docs/` with one folder per agent and a README of what to upload and ask.
- **Concurrency crash fixed.** Six agents at once crashed the server (PyTorch Metal assertion from parallel embed/rerank). All local model calls now hold one `MODEL_LOCK`.
- **Reranker in fp16 with 512-token inputs:** 3.9 s to 1.1 s per question on the Mac, identical top-3 on the benchmark questions; `RERANK_FP16=off` to disable. Red Team run went from minutes to 38 s.
- **Citations:** the model also writes `[S1 §2]`, `[S2: DP-04]` and bare `S8` in table Source cells. These are now recognised (bare labels only as whole table cells, so "S3 bucket" in prose is not a citation). This was why the Compliance Checker refused.
- **Compliance retrieval decomposes long documents:** one search per section (up to 12), best 3 per section, merged to 12. Before, the whole design doc as one query ranked the wrong policy first.
- **Red Team credit is honest:** a defence layer is credited only when the same attack worked with the defence off. Live result: 2 of 6 attacks got through with the defence off, 0 with it on (both stopped by the quarantine).
- **Talk-day note:** the Mac slept for 15 minutes mid-run. Run the server under `caffeinate -i` (or disable sleep) on the day.
- **Live calls used tonight:** about 35 GLM calls, roughly ₹7.

## Domain experts (2026-09-24, user request)

- **Domain Expert is now one expert per domain:** Generative AI, GenAI Security, AWS Cloud, Azure AI Foundry, Software Engineering (`config/domains.yaml`). Documents uploaded into a domain live in `corpus/uploads/<domain>/`, every chunk carries a `domain` payload, and the expert's search is filtered to its domain. The other agents still search every document.
- **No grounding guardrails for the Domain Expert (user request).** It uses its domain's documents when relevant, cites them, and otherwise answers from GLM's own knowledge; it never refuses and has no output-check redaction. Retrieved text is still delimited, and hidden text is still quarantined at ingestion, so a poisoned PDF cannot take it over; the Defence toggle still applies.
- **The grounded expert still exists** as `expert_strict` (hidden from the UI). The Red Team attacks it, because its guardrails are what the exercise measures.
- **Sample foundation documents:** 16 PDFs, 56 pages, about 12,000 words in `test_docs/domains/<domain>/`, loaded per domain with one click (`POST /api/domains/<id>/load-samples`). Cloud-service details are summaries; each document says to confirm against official docs.
- **Quarantine now distinguishes hiding from mentioning.** The GenAI Security handbooks quote attack phrases and had 5 passages quarantined. Visible text with instruction-like phrases is now indexed and tagged `instruction_like`; hidden text (white, tiny, off-page) and instruction text read from images are still quarantined. The poisoned FAQ's two hidden injections are still caught.
- **Eval:** 22/22 retrieval hit@6 including 10 domain questions searched within their domain.

## Multilingual answers (2026-09-24, user request)

- **Languages:** English, Tamil, Hindi, Telugu, Kannada, Malayalam, Bengali, French, Spanish (`app/language.py`). The UI itself stays in English (answers only; the user did not ask for UI translation).
- **Detection:** Indian languages by Unicode script block; English/French/Spanish with `lingua` (offline). Code blocks are ignored so pasted code does not decide the language. Short Latin text defaults to English.
- **Choosing the language:** a picker in the composer, "Auto" (answer in the question's language) or a forced language; stored per conversation. The server validates the code.
- **Prompts:** "Answer in Hindi (हिन्दी), written in Devanagari script. Keep code, commands, rule IDs, product and service names, and numbers exactly as written". Refusals exist in all nine languages.
- **Cross-language search:** BGE-M3 and the reranker match most languages to English documents directly (7 of 8 languages in the eval). Short Telugu questions scored under the reranker cut-off (0.006 on the right passage), so when a non-English question's best match is below 0.1 the service asks GLM for an English translation (one short call, cached), searches again and merges. The answer is still written in the user's language, and the run log shows the translated query.
- **Ingestion:** the broken-text-layer check now covers every supported Indian script, and scans are OCR'd with English plus the page's own language pack.
- **Fonts:** Noto Sans for Devanagari, Telugu, Kannada, Malayalam and Bengali bundled for offline use.
- **Browser tests** now target the built app on :8010 by default; port 5173 was taken by another local project and Playwright had been testing that site.

## Live check fixes (2026-09-26)
- **Scanner line numbers match the model's.** When a message contains fenced code, the scanner reads only the code and numbers lines from 1 inside each block, which is how GLM numbers them. Prose outside the fences is not scanned. The Security prompt states the same convention.
- **No stray English in non-English answers.** A live Hindi answer contained "of" twice. The language instruction now says that technical terms stay as written, but connecting words (of, the, and, for, to) must be in the target language.

## Conversation memory and typed answers (2026-09-26)
- **Memory lives in the chat, not on the server.** Each question sends that chat's earlier answered turns (at most 6; the server uses the last 4, each trimmed to 2,000 characters). The server stores no session state, and each chat's memory is separate. The Red Team is excluded because it is a one-shot exercise.
- **Follow-ups search with context.** "Explain that mathematically" has no topic of its own, so the search query is the previous question plus the new one. This costs no extra model call. The prompt carries the earlier turns as user/assistant messages.
- **Old citation labels are stripped from history.** [S2] in an earlier answer referred to that turn's sources. The model is told to cite only the new sources, and the citation validator still checks every label against this turn's retrieval.
- **Typing is a client-side reveal, not token streaming.** Answers are validated as a whole (citations checked, invalid labels removed, output checked) before anything is shown. Streaming raw tokens would show text that validation later removes. The UI types out the validated answer a few characters per frame; long answers speed up so none takes more than about 5 seconds. Half-typed markdown is closed so it never flashes raw symbols. A click shows the whole answer. Sources and the pipeline log appear when typing ends. Typing only runs on a fresh answer, and never with reduced motion or in automated browsers.
- **Math renders with KaTeX.** Maths answers come back as LaTeX, so the chat renders `$$…$$` and `\[…\]` as centred display equations, and `$…$` and `\(…\)` inline. KaTeX and its fonts are bundled (no CDN), escape their input and run with `trust: false`. A price like "$5 and $10" stays text because inline math must hug its content. The prompt asks GLM to use these delimiters. While an answer types, a half-typed formula is held back until it closes, so raw LaTeX never flashes. `*Italics*` also render now.
