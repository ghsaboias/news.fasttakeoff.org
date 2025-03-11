import { promises as fs } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ordersJsonPath = join(__dirname, "../public/orders.json");
const ordersFilePath = join(
  __dirname,
  "../app/executive-orders/orders-data.ts"
);

function validateOrder(order, index) {
  const issues = [];
  if (!order.data) {
    order.data = {};
    issues.push(`Order ${index}: Missing data object`);
  }
  if (!order.content) {
    order.content = {};
    issues.push(`Order ${index}: Missing content object`);
  }
  if (!order.data.agencies) {
    order.data.agencies = [];
    issues.push(`Order ${index}: Missing agencies array`);
  }
  if (!order.content.page_views) {
    order.content.page_views = { count: 0, last_updated: "" };
    issues.push(`Order ${index}: Missing page_views object`);
  }
  order.data.title = order.data.title || "";
  order.data.document_number = order.data.document_number || `UNKNOWN-${index}`;
  order.data.publication_date =
    order.data.publication_date || new Date().toISOString();
  order.data.html_url = order.data.html_url || "#";
  return issues;
}

async function injectOrdersData() {
  try {
    console.log("Reading orders data from", ordersJsonPath);
    if (!(await fs.stat(ordersJsonPath).catch(() => false))) {
      console.error("Error: orders.json not found");
      process.exit(1);
    }

    const ordersData = await fs.readFile(ordersJsonPath, "utf8");
    let orders = JSON.parse(ordersData);

    if (!Array.isArray(orders)) {
      console.error("Error: orders.json must contain an array");
      process.exit(1);
    }

    const allIssues = [];
    orders = orders.map((order, index) => {
      if (!order || typeof order !== "object") {
        order = { data: {}, content: {} };
        allIssues.push(`Order ${index}: Invalid order object`);
      }
      const issues = validateOrder(order, index);
      allIssues.push(...issues);
      return order;
    });

    if (allIssues.length > 0) {
      console.warn("\nValidation issues found:");
      allIssues.forEach((issue) => console.warn(`- ${issue}`));
      console.warn("\nDefault values have been applied where necessary.\n");
    }

    const ordersDataString = `import type { Order } from '../components/Orders';\n\nexport const orders: Order[] = ${JSON.stringify(
      orders,
      null,
      2
    )};\n`;
    await fs.writeFile(ordersFilePath, ordersDataString);
    console.log("Successfully injected orders into orders-data.ts");
  } catch (error) {
    console.error("Error injecting orders:", error);
    process.exit(1);
  }
}

injectOrdersData();
