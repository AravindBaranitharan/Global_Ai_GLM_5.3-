import time, requests

BASE = "https://billing.internal.example"

def fetch_invoice(invoice_id):
    for attempt in range(10):
        try:
            return requests.get(f"{BASE}/invoices/{invoice_id}").json()
        except Exception:
            time.sleep(1)
