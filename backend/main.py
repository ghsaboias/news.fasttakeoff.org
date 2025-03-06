from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import json

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://news.aiworld.com.br"],  # Allow our Next.js frontend
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

@app.get("/orders")
async def get_orders():
    try:
        with open("orders.json", "r") as f:
            orders = json.load(f)
        return JSONResponse(content=orders)
    except FileNotFoundError:
        return JSONResponse(content={"error": "Orders not found"}, status_code=404)
