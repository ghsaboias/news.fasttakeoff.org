from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import json
from typing import Optional
from groq import Groq
import os
from dotenv import load_dotenv

load_dotenv()

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

@app.post("/summarize/{document_number}")
async def summarize_order(document_number: str):
    try:
        # Read the current orders
        with open("orders.json", "r") as f:
            orders = json.load(f)
        
        # Find the order with the matching document number
        order = next((order for order in orders if order["data"]["document_number"] == document_number), None)
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
            
        # Check if we already have a summary
        if order.get("summary"):
            return JSONResponse(content=order)
            
        # Get the raw text to summarize
        raw_text = order.get("raw_text")
        if not raw_text:
            raise HTTPException(status_code=400, detail="No raw text available for summarization")
            
        # Initialize Groq client
        groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        
        # Generate summary
        try:
            completion = groq_client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that summarizes executive orders. Provide a clear, concise summary that captures the key points and implications."
                    },
                    {
                        "role": "user",
                        "content": f"Please summarize this executive order: {raw_text}"
                    }
                ],
                model="mixtral-8x7b-32768",
                temperature=0.3,
                max_tokens=500
            )
            
            summary = completion.choices[0].message.content
            
            # Update the order with the summary
            order["summary"] = summary
            order["metadata"]["summarized"] = True
            
            # Save the updated orders back to the file
            with open("orders.json", "w") as f:
                json.dump(orders, f, indent=2)
                
            return JSONResponse(content=order)
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error generating summary: {str(e)}")
            
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Orders file not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
