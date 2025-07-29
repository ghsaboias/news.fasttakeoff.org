const fs = require("fs");
const path = require("path");

const workerPath = path.resolve(".open-next/worker.js");

// Read the existing worker.js content
let content = "";
try {
  content = fs.readFileSync(workerPath, "utf8");
} catch (error) {
  console.error(`Failed to read ${workerPath}: ${error.message}`);
  process.exit(1);
}

// Add cron import at the top
let newContent = `import { scheduled } from "../src/lib/cron";\n` + content;

// Find the default export and modify it to include scheduled
const defaultExportRegex = /export default \{([^}]*)\}/;
const match = newContent.match(defaultExportRegex);
if (match) {
  const exportContent = match[1].trim();
  // Add scheduled to the default export
  newContent = newContent.replace(
    defaultExportRegex,
    `export default {\n    scheduled,\n${exportContent}\n}`
  );
} else {
  console.error("Could not find default export in worker.js");
  process.exit(1);
}

// Write the updated content back
try {
  fs.writeFileSync(workerPath, newContent, "utf8");
} catch (error) {
  console.error(`Failed to write to ${workerPath}: ${error.message}`);
  process.exit(1);
}
