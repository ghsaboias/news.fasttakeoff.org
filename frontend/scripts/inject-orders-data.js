const fs = require("fs");
const path = require("path");

const ordersJsonPath = path.join(__dirname, "../public/orders.json");
const ordersFilePath = path.join(
  __dirname,
  "../app/executive-orders/orders-data.ts"
);

async function injectOrdersData() {
  try {
    console.log("Reading orders data from", ordersJsonPath);
    if (!fs.existsSync(ordersJsonPath)) {
      console.error("Error: orders.json not found");
      process.exit(1);
    }

    const ordersData = fs.readFileSync(ordersJsonPath, "utf8");
    const orders = JSON.parse(ordersData);
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
