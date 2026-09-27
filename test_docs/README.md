# Test datasets

Everything here is fictional or summarised for testing this demo. Regenerate with:

    python scripts/make_datasets.py

## Live demo on stage

`live_demo/` holds five fictional PDFs (a launch brief, a product spec, an incident report, a scanned
English/Tamil page and a quotation with hidden text) plus `live_demo/README.md`, a step-by-step demo script with
questions and expected answers. Upload them into **Domain Expert → Live Demo** from the Documents panel.

## Domain Expert: one knowledge base per domain

Open **Domain Expert** in the sidebar, pick a domain, and click **Load sample documents**. That indexes
the PDFs in `domains/<domain>/` into that domain. You can also upload your own PDFs into a domain from
the Documents panel. The Domain Expert answers from the domain's documents plus GLM's own knowledge.

| Folder | Domain | Documents |
|---|---|---|
| `domains/generative_ai/` | Generative AI | LLM foundations, RAG engineering handbook, agents and evaluation |
| `domains/genai_security/` | GenAI Security | Threat landscape (OWASP LLM Top 10), defending GenAI apps, AI red teaming and SOC |
| `domains/aws/` | AWS Cloud | Security and identity, networking/compute/storage, Well-Architected and Bedrock |
| `domains/azure_ai_foundry/` | Azure AI Foundry | Platform overview, RAG and agents, responsible AI and evaluation |
| `domains/software_engineering/` | Software Engineering | REST API guidelines, secure Python standard, payments API guide, operations runbook |

## The other agents (guardrails on: they answer only from uploaded documents)

**Upload** PDFs from the yellow **Documents** button. **Paste** `.py`, `.yaml`, `.md` and `.txt` samples into the chat.
**Attach** `.png` diagrams to the Threat Modeler with **Attach diagram**.

| Folder | Agent | Upload these PDFs | Use these in the chat |
|---|---|---|---|
| `02_code_reviewer/` | Code Reviewer | load the **Software Engineering** domain | paste `samples/*.py` |
| `03_security_agent/` | Security Agent | `application_security_policy.pdf` | paste `samples/*` |
| `04_threat_modeler/` | Threat Modeler | `threat_modeling_playbook.pdf` | attach `diagrams/*.png` |
| `05_red_team/` | Red Team | `partner_integration_faq_poisoned.pdf` (hidden injections) | click **Run exercise** |
| `06_compliance_checker/` | Compliance Checker | `data_protection_policy.pdf` | paste `samples/*.md` |

## Questions to try

**Domain Expert** (pick the domain first): each domain shows suggested questions. A few more:
- Generative AI: "How much GPU memory does a 70B model need at 4-bit?" · "What is reciprocal rank fusion?"
- GenAI Security: "How do attackers hide prompt injections in PDFs?" · "What is the dual-LLM pattern?"
- AWS: "How does IAM evaluate an explicit deny?" · "When should I use Spot Instances?"
- Azure AI Foundry: "Global Standard or Provisioned deployment?" · "What do Prompt Shields check?"
- Software Engineering: "What is the best way to design a REST API?" · "How do I send ₹499 in a payment request?"
- Questions outside the documents also get an answer, from GLM's own knowledge.

**Code Reviewer**: paste `refund_service.py`, `retry_client.py` or `orders_api.py`.
**Security Agent**: paste `vulnerable_webhook.py`, `vulnerable_login.py`, `leaked_config.yaml` or `suspicious_partner_email.txt`.
**Threat Modeler**: attach `checkout_platform.png`, `rag_assistant.png` or `iot_telemetry.png`.
**Red Team**: upload `partner_integration_faq_poisoned.pdf`, open Red Team, click **Run exercise** (about 13 model calls).
**Compliance Checker**: paste `design_doc_loyalty_service.md` (many failures) or `design_doc_support_assistant.md` (mostly compliant).
