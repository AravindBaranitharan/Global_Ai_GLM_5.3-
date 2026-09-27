from fastapi import FastAPI, Request

app = FastAPI()

@app.get("/getOrders")
def get_orders(page: int = 1, customerId: str = ""):
    rows = db.execute("SELECT * FROM orders WHERE customer = '" + customerId + "' LIMIT 50 OFFSET " + str((page - 1) * 50))
    orders = []
    for r in rows:
        items = db.execute(f"SELECT * FROM items WHERE order_id = {r.id}")   # one query per order
        orders.append({"orderId": r.id, "createdAt": str(r.created), "amount": float(r.amount), "items": list(items)})
    return orders

@app.post("/createOrder")
async def create_order(req: Request):
    body = await req.json()
    try:
        order = save(body)
    except Exception as e:
        return {"error": str(e), "trace": repr(e.__traceback__)}
    return order
