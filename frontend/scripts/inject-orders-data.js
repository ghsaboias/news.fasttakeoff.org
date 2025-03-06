const fs = require("fs");
const path = require("path");

const ordersJsonPath = path.join(__dirname, "../public/orders.json");
const pageFilePath = path.join(__dirname, "../app/executive-orders/page.tsx");

async function injectOrdersData() {
  try {
    console.log("Reading orders data from", ordersJsonPath);
    if (!fs.existsSync(ordersJsonPath)) {
      console.error("Error: orders.json not found in public directory");
      process.exit(1);
    }

    const ordersData = fs.readFileSync(ordersJsonPath, "utf8");
    const orders = JSON.parse(ordersData);
    const pageContent = fs.readFileSync(pageFilePath, "utf8");

    const ordersDataString = `const orders = ${JSON.stringify(
      orders,
      null,
      2
    )};\n\n`;

    let newContent;
    if (pageContent.includes("const orders =")) {
      newContent = pageContent.replace(
        /const orders =[\s\S]*?;\n\n/,
        ordersDataString
      );
    } else {
      const importEndIndex = pageContent.lastIndexOf("import");
      const importEndLineIndex = pageContent.indexOf("\n", importEndIndex) + 1;
      newContent =
        pageContent.substring(0, importEndLineIndex) +
        "\n" +
        ordersDataString +
        pageContent.substring(importEndLineIndex);
    }

    fs.writeFileSync(pageFilePath, newContent);
    console.log("Successfully injected orders data into page.tsx");
  } catch (error) {
    console.error("Error injecting orders data:", error);
    process.exit(1);
  }
}

injectOrdersData();
