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

// Add cron import and fetch override at the top
const fetchOverride = `
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const parsedUrl = new URL(url instanceof Request ? url.url : url);
  if (parsedUrl.pathname.startsWith('/_next/image')) {
    const imageUrl = parsedUrl.searchParams.get('url');
    if (imageUrl && imageUrl.includes('cdn.discordapp.com/attachments')) {
      const headers = new Headers(init.headers || {});
      headers.set('Authorization', process.env.DISCORD_TOKEN); // Raw user token
      return originalFetch(url, { ...init, headers });
    }
  }
  return originalFetch(url, init);
};
`;

let newContent =
  `import { scheduled } from "../src/lib/cron";\n${fetchOverride}\n` + content;

// Find the default export and modify it to include scheduled
const defaultExportRegex = /export default \{([^}]*)\}/;
const match = newContent.match(defaultExportRegex);
if (match) {
  const exportContent = match[1].trim();
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
  console.log("Patched worker.js with cron handler and fetch override");
} catch (error) {
  console.error(`Failed to write to ${workerPath}: ${error.message}`);
  process.exit(1);
}
