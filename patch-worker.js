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

// Build an idempotent injection that adapts Modules scheduled(controller, env, ctx)
// to the library's scheduled(event, env) shape, forwarding ctx.waitUntil.
// Also inject queue handler for financial data processing.
const injection = `import { scheduled as cronScheduled, queue as queueHandler } from "../src/lib/cron";\n\nfunction scheduled(controller, env, ctx) {\n  const event = {\n    scheduledTime: controller.scheduledTime,\n    cron: controller.cron,\n    waitUntil: (p) => ctx && ctx.waitUntil ? ctx.waitUntil(p) : undefined,\n  };\n  return cronScheduled(event, env, ctx);\n}\n\nfunction queue(batch, env, ctx) {\n  return queueHandler(batch, env, ctx);\n}\n`;

// If an older import existed, remove it to avoid duplicate bindings
content = content.replace(/^import \{\s*scheduled[^}]*\} from "\.\.\/src\/lib\/cron";\n/m, "");

// Prepend injection only if not already present
let newContent = content.includes("function scheduled(controller, env, ctx)") && content.includes("function queue(batch, env, ctx)")
  ? content
  : injection + content;

// Find the default export and modify it to include scheduled and queue
const defaultExportRegex = /export default \{([^}]*)\}/;
const match = newContent.match(defaultExportRegex);
if (match) {
  const exportContent = match[1].trim();
  let needsScheduled = !/\bscheduled\b\s*[,;]/.test(exportContent);
  let needsQueue = !/\bqueue\b\s*[,;]/.test(exportContent);

  if (needsScheduled || needsQueue) {
    let additions = [];
    if (needsScheduled) additions.push("scheduled");
    if (needsQueue) additions.push("queue");

    newContent = newContent.replace(
      defaultExportRegex,
      `export default {\n    ${additions.join(",\n    ")},\n${exportContent}\n}`
    );
  }
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
