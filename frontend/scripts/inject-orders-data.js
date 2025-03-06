const fs = require("fs");
const path = require("path");

// Paths
const ordersJsonPath = path.join(__dirname, "../public/orders.json");
const pageFilePath = path.join(__dirname, "../app/executive-orders/page.tsx");

// Main function
async function injectOrdersData() {
  try {
    console.log("Reading orders data from", ordersJsonPath);

    // Check if orders.json exists
    if (!fs.existsSync(ordersJsonPath)) {
      console.error("Error: orders.json not found in public directory");
      process.exit(1);
    }

    // Read orders data
    const ordersData = fs.readFileSync(ordersJsonPath, "utf8");
    const orders = JSON.parse(ordersData);

    // Read current page.tsx content
    const pageContent = fs.readFileSync(pageFilePath, "utf8");

    // Check if data is already injected
    if (pageContent.includes("const orders =")) {
      console.log("Orders data already injected, replacing with fresh data");
    }

    // Create new content with injected data
    const ordersDataString = `const orders = ${JSON.stringify(
      orders,
      null,
      2
    )};\n\n`;

    // Replace existing injected data or add new data
    let newContent;
    if (pageContent.includes("const orders =")) {
      // Replace existing data
      newContent = pageContent.replace(
        /const orders =[\s\S]*?;\n\n/,
        ordersDataString
      );
    } else {
      // Add new data at the beginning, after imports
      const importEndIndex = pageContent.lastIndexOf("import");
      const importEndLineIndex = pageContent.indexOf("\n", importEndIndex) + 1;

      newContent =
        pageContent.substring(0, importEndLineIndex) +
        "\n" +
        ordersDataString +
        pageContent.substring(importEndLineIndex);
    }

    // Write updated content back to file
    fs.writeFileSync(pageFilePath, newContent);
    console.log("Successfully injected orders data into page.tsx");
  } catch (error) {
    console.error("Error injecting orders data:", error);
    process.exit(1);
  }
}

// Run the function
injectOrdersData();
