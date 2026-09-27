import hmac, pickle

WEBHOOK_SECRET = b"whsec_4f9a1c0e7b2d"

@app.post("/webhooks/payments")
def webhook(req):
    payload = pickle.loads(req.body)
    expected = hmac.new(WEBHOOK_SECRET, req.body, "sha256").hexdigest()
    if req.headers.get("X-Signature") == expected:
        process(payload)
    return {"ok": True}
