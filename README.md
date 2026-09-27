# Domain Specialist RAG

Self-hosted multimodal RAG on GLM-5.3-Flash with three agents: Domain Expert, Code Reviewer and Security Agent. Plan: `BUILD_PLAN.md`. Decisions and measurements: `DECISIONS.md`.

## Run locally

```bash
docker run -d --name lowkey-qdrant -p 6333:6333 -e QDRANT__TELEMETRY_DISABLED=true -v "$PWD/data/qdrant:/qdrant/storage" qdrant/qdrant:v1.12.4
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/download_models.py        # once, needs internet
cp .env.example .env                               # add LLM_API_KEY
.venv/bin/python scripts/make_domain_docs.py      # sample PDFs in test_docs/; upload them from the Documents button
cd ui && npm install && npm run build && cd ..
.venv/bin/uvicorn app.api.main:app --port 8010     # UI and API at http://localhost:8010
```

UI development with hot reload: `cd ui && npm run dev` (http://localhost:5173, proxies `/api` to :8010).

## Tests (none of these call the paid endpoint)

```bash
.venv/bin/python -m pytest -q                      # backend
.venv/bin/python -m eval.run_eval --retrieval-only # retrieval and ACL scores
cd ui && npm test && npx playwright test           # UI unit and browser tests
```

`python -m eval.run_eval --label cloud` runs the full golden set through the LLM (paid, about 35 calls).
