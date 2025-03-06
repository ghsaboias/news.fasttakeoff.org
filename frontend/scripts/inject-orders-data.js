const fs = require("fs");
const path = require("path");

const ordersJsonPath = path.join(__dirname, "../public/orders.json");
const ordersFilePath = path.join(
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

  // Ensure required nested objects exist
  if (!order.data.agencies) {
    order.data.agencies = [];
    issues.push(`Order ${index}: Missing agencies array`);
  }

  if (!order.content.page_views) {
    order.content.page_views = { count: 0, last_updated: "" };
    issues.push(`Order ${index}: Missing page_views object`);
  }

  // Set default values for commonly used fields
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
    if (!fs.existsSync(ordersJsonPath)) {
      console.error("Error: orders.json not found");
      process.exit(1);
    }

    const ordersData = fs.readFileSync(ordersJsonPath, "utf8");
    let orders = [];

    try {
      orders = JSON.parse(ordersData);
    } catch (error) {
      console.error("Error parsing orders.json:", error);
      process.exit(1);
    }

    if (!Array.isArray(orders)) {
      console.error("Error: orders.json must contain an array");
      process.exit(1);
    }

    // Validate and fix each order
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

    // Log all validation issues
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

    fs.writeFileSync(ordersFilePath, ordersDataString);
    console.log("Successfully injected orders into orders-data.ts");
  } catch (error) {
    console.error("Error injecting orders:", error);
    process.exit(1);
  }
}

injectOrdersData();
