import { promises as fs } from "fs";
import fetch from "node-fetch";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = "https://www.federalregister.gov/api/v1";
const OUTPUT_PATH = join(__dirname, "../public/orders.json");

async function fetchAllOrders(startDate = "2025-01-20") {
  let orders = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      "conditions[presidential_document_type][]": "executive_order",
      "conditions[signing_date][gte]": startDate,
      per_page: "20",
      page: page.toString(),
    });

    const response = await fetch(`${BASE_URL}/documents.json?${params}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();

    if (!data.results || data.results.length === 0) break;
    orders = orders.concat(data.results);
    page++;
    console.log(`Fetched page ${page - 1}, total orders: ${orders.length}`);
  }

  return orders;
}

async function fetchDetails(documentNumber) {
  const response = await fetch(`${BASE_URL}/documents/${documentNumber}.json`);
  if (!response.ok) return {};
  return response.json();
}

async function saveOrders() {
  try {
    const orders = await fetchAllOrders();
    const detailedOrders = await Promise.all(
      orders.map(async (order) => {
        const details = await fetchDetails(order.document_number);
        return {
          data: order,
          content: details,
          raw_text:
            details.full_text_xml || details.body_html || order.abstract || "",
          summary: null,
          metadata: {
            saved_at: new Date().toISOString(),
            summarized: false,
          },
        };
      })
    );

    await fs.mkdir(dirname(OUTPUT_PATH), { recursive: true });
    await fs.writeFile(OUTPUT_PATH, JSON.stringify(detailedOrders, null, 2));
    console.log(`Saved ${detailedOrders.length} orders to ${OUTPUT_PATH}`);
  } catch (error) {
    console.error("Error fetching/saving orders:", error);
    process.exit(1);
  }
}

saveOrders();
