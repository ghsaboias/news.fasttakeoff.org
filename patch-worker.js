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
const injection = `import { scheduled as cronScheduled } from "../src/lib/cron";\n\nfunction scheduled(controller, env, ctx) {\n  const event = {\n    scheduledTime: controller.scheduledTime,\n    cron: controller.cron,\n    waitUntil: (p) => ctx && ctx.waitUntil ? ctx.waitUntil(p) : undefined,\n  };\n  return cronScheduled(event, env);\n}\n`;

// If an older import existed, remove it to avoid duplicate bindings
content = content.replace(/^import \{\s*scheduled\s*\} from "\.\.\/src\/lib\/cron";\n/m, "");

// Prepend injection only if not already present
let newContent = content.includes("function scheduled(controller, env, ctx)")
  ? content
  : injection + content;

// Find the default export and modify it to include scheduled
const defaultExportRegex = /export default \{([^}]*)\}/;
const match = newContent.match(defaultExportRegex);
if (match) {
  const exportContent = match[1].trim();
  // Only add scheduled if not already present in default export
  if (!/\bscheduled\b\s*[,;]/.test(exportContent)) {
    newContent = newContent.replace(
      defaultExportRegex,
      `export default {\n    scheduled,\n${exportContent}\n}`
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
