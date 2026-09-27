import type { AgentId } from '../api'

/** Starter prompts per agent. They match the sample PDFs in test_docs/. */
export type Suggestion = { label: string; prompt: string }

const REFUND = `Review this function:

\`\`\`python
import requests, subprocess

API_KEY = "sk-live-9f8e7d6c5b4a"

def refund(order_id, amount):
    row = db.execute(f"SELECT * FROM orders WHERE id = {order_id}").fetchone()
    try:
        r = requests.post("https://api.payments.example/v2/refunds",
                          json={"payment": row.payment_id, "amount": amount},
                          headers={"Authorization": f"Bearer {API_KEY}"}, verify=False)
    except:
        pass
    subprocess.run(f"notify-team {order_id}", shell=True)
    return r.json()
\`\`\``

const RETRY = `Does this follow our retry and timeout rules?

\`\`\`python
def fetch_invoice(invoice_id):
    for attempt in range(10):
        try:
            return requests.get(f"{BASE}/invoices/{invoice_id}").json()
        except Exception:
            time.sleep(1)
\`\`\``

const WEBHOOK = `Check this webhook handler for vulnerabilities:

\`\`\`python
@app.post("/webhooks/payments")
def webhook(req):
    payload = pickle.loads(req.body)
    expected = hmac.new(WEBHOOK_SECRET, req.body, "sha256").hexdigest()
    if req.headers.get("X-Signature") == expected:
        process(payload)
    return {"ok": True}
\`\`\``

const TOKENS = `Is this token and password code acceptable?

\`\`\`python
import random, hashlib

def reset_code():
    return str(random.randint(100000, 999999))

def store_password(user, pw):
    user.password = hashlib.md5(pw.encode()).hexdigest()
\`\`\``

const LOYALTY = `Check this design doc against our policies:

# Design doc: Loyalty Points Service
- We store customer name, email, phone, date of birth and full address.
- All loyalty data is kept for 7 years after the account is closed.
- The Loyalty API runs in the Singapore region (ap-southeast-1).
- PostgreSQL encryption at rest is "planned for Q2".
- Nightly export of raw customer emails and phone numbers to the marketing analytics tool.
- A third-party offers engine receives the full profile; its vendor contract is still under negotiation.
- An LLM on a public AI API gets the profile and last 50 orders to write offers; customers aged 13-17 get offers from their browsing.
- Marketing emails go to all members by default; unsubscribing means contacting support.
- Deletion requests are handled manually when time allows. No DPIA was done.`

export const SUGGESTIONS: Record<AgentId, Suggestion[]> = {
  expert: [
    { label: 'Retries', prompt: 'What does the standard say about retries and backoff?' },
    { label: 'Passwords', prompt: 'How must passwords be stored?' },
    { label: 'Webhooks', prompt: 'How do I verify a payments webhook?' },
    { label: 'தமிழ்', prompt: 'ரகசிய விசைகளை எவ்வளவு நாட்களுக்கு ஒருமுறை மாற்ற வேண்டும்?' },
  ],
  code_review: [
    { label: 'Refund function', prompt: REFUND },
    { label: 'Retry loop', prompt: RETRY },
  ],
  threat_model: [
    { label: 'Checkout system', prompt: 'Threat model this system: web and mobile apps call a WAF and API gateway, which forwards HTTP to a checkout service. Checkout calls a payments service over gRPC. Payments calls a third-party card processor over HTTPS and receives its status webhooks, writes to payments-db, and publishes to Kafka. An admin console on the office network connects to orders-db with a shared admin password.' },
    { label: 'RAG assistant', prompt: 'Threat model this system: employees upload PDFs to a FastAPI app that indexes them into Qdrant and asks a self-hosted LLM. Partner emails are imported automatically over IMAP and become searchable documents. Answers and questions are logged to SQLite.' },
  ],
  compliance: [
    { label: 'Loyalty service', prompt: LOYALTY },
    { label: 'Policy question', prompt: 'Which of our data protection rules apply to machine-learning datasets?' },
  ],
  red_team: [
    { label: 'Full exercise', prompt: 'Run a full red-team exercise against the assistant.' },
    { label: 'Hidden instructions', prompt: 'Focus on triggering hidden instructions planted in the documents.' },
    { label: 'Prompt leakage', prompt: 'Focus on extracting the system prompt and security rules.' },
  ],
  security: [
    { label: 'Webhook handler', prompt: WEBHOOK },
    { label: 'Tokens & passwords', prompt: TOKENS },
    { label: 'Policy question', prompt: 'Does our standard allow HS256 for signing tokens?' },
  ],
}
