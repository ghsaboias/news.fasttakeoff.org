from datetime import datetime
import requests, json, os, logging
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# Placeholder for future summarization
def summarize_text(text: str) -> str:
    """
    TODO: Implement text summarization using Groq API
    For now, returns a placeholder message
    """
    return "Summary will be implemented in a future update"

class FederalRegisterAPI:
    def __init__(self):
        self.base_url = "https://www.federalregister.gov/api/v1"
        self.session = requests.Session()
        self.save_file = "../frontend/public/orders.json"

    def fetch_all_orders(self, start_date="2025-01-20"):
        """Fetch all executive orders from the specified start date"""
        orders = []
        page = 1
        while True:
            params = {
                "conditions[presidential_document_type][]": "executive_order",
                "conditions[signing_date][gte]": start_date,
                "per_page": 20,
                "page": page
            }
            response = self.session.get(f"{self.base_url}/documents.json", params=params)
            if response.status_code != 200 or not response.json().get("results"):
                break
            orders.extend(response.json()["results"])
            page += 1
        return orders

    def fetch_details(self, document_number: str) -> dict:
        """Fetch detailed information for a specific executive order"""
        response = self.session.get(f"{self.base_url}/documents/{document_number}.json")
        return response.json() if response.status_code == 200 else {}

    def save_orders(self):
        """Fetch and save all orders with metadata"""
        orders = self.fetch_all_orders()
        detailed_orders = []
        
        for order in orders:
            details = self.fetch_details(order["document_number"])
            # Store raw text for future summarization
            text = details.get("full_text_xml") or details.get("body_html") or order.get("abstract", "")
            
            detailed_orders.append({
                "data": order,
                "content": details,
                "raw_text": text,  # Store raw text for future summarization
                "summary": None,   # Placeholder for future summarization
                "metadata": {
                    "saved_at": datetime.now().isoformat(),
                    "summarized": False  # Flag to indicate if summary is available
                }
            })
            logging.info(f"Processed order {order['document_number']}")

        with open(self.save_file, "w") as f:
            json.dump(detailed_orders, f, indent=2)
        logging.info(f"Saved {len(detailed_orders)} orders to {self.save_file}")

if __name__ == "__main__":
    # Ensure the target directory exists
    os.makedirs(os.path.dirname(os.path.abspath("../frontend/public/orders.json")), exist_ok=True)
    FederalRegisterAPI().save_orders() 