const fs = require("fs");
const path = require("path");

const workerPath = path.resolve(".open-next/worker.js");
let content = fs.readFileSync(workerPath, "utf8");

// Add cron import and export
content =
  `import { scheduled } from "../src/lib/cron";\nexport { scheduled };\n` +
  content;

fs.writeFileSync(workerPath, "utf8", content);
console.log("Patched worker.js with cron handler");
