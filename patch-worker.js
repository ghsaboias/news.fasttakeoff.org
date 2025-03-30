const fs = require("fs");
const path = require("path");

const workerPath = path.resolve(".open-next/worker.js");

// Read the existing worker.js content
let content = "";
try {
  content = fs.readFileSync(workerPath, "utf8");
  console.log("[Patch] Successfully read worker.js");
} catch (error) {
  console.error(`[Patch] Failed to read ${workerPath}: ${error.message}`);
  process.exit(1);
}

// Add cron import and enhanced fetch override with comprehensive logging
const fetchOverride = `
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  console.log("[Worker] Fetch intercepted: " + url);
  console.log("[Worker] Request headers: " + JSON.stringify([...(init.headers || [])]));
  const parsedUrl = new URL(url instanceof Request ? url.url : url);
  console.log("[Worker] Pathname: " + parsedUrl.pathname);
  if (parsedUrl.pathname.startsWith('/_next/image')) {
    const imageUrl = parsedUrl.searchParams.get('url');
    console.log("[Worker] /_next/image detected, target URL: " + imageUrl);
    if (imageUrl && imageUrl.includes('cdn.discordapp.com/attachments')) {
      console.log("[Worker] Patching Discord attachment: " + imageUrl);
      const headers = new Headers(init.headers || {});
      const token = process.env.DISCORD_TOKEN;
      headers.set('Authorization', token);
      console.log("[Worker] Added Authorization header, token length: " + (token ? token.length : 'undefined'));
      const response = await originalFetch(url, { ...init, headers });
      console.log("[Worker] Response status: " + response.status);
      return response;
    } else {
      console.log("[Worker] /_next/image but not a Discord attachment: " + imageUrl);
    }
  } else {
    console.log("[Worker] Not an /_next/image request");
  }
  const response = await originalFetch(url, init);
  console.log("[Worker] Non-patched response status: " + response.status);
  return response;
};
`;

let newContent =
  `import { scheduled } from "../src/lib/cron";\n${fetchOverride}\n` + content;

// Patch the default export to include scheduled
const defaultExportRegex = /export default \{([^}]*)\}/;
const match = newContent.match(defaultExportRegex);
if (match) {
  const exportContent = match[1].trim();
  newContent = newContent.replace(
    defaultExportRegex,
    `export default {\n    scheduled,\n${exportContent}\n}`
  );
  console.log("[Patch] Successfully patched default export with scheduled");
} else {
  console.error("[Patch] Could not find default export in worker.js");
  process.exit(1);
}

// Write the updated content back
try {
  fs.writeFileSync(workerPath, newContent, "utf8");
  console.log("[Patch] Successfully wrote patched worker.js");
} catch (error) {
  console.error(`[Patch] Failed to write to ${workerPath}: ${error.message}`);
  process.exit(1);
}
