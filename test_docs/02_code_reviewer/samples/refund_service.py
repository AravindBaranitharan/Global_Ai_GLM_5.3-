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
