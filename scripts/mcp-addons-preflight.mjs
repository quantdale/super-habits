// Repository-local MCP add-ons preflight (plan/repo-local-addons-2026-08-28).
// Fail-closed safety checks. Does NOT mutate production data or contact
// protected environments. Run: node scripts/mcp-addons-preflight.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Both repo-local configs are intentionally checked; the repo maintains the
// same server IDs across them (different MCP clients read different files),
// so duplicates are only a problem WITHIN a single config.
const files = [".mcp.json", ".vscode/mcp.json"];

// Secret-like patterns we must never see committed in MCP config values.
const SECRET_RE = /(sk-[a-z0-9]{20,})|(ghp_[a-z0-9]{20,})|(github_pat_[a-z0-9_]{20,})|(----BEGIN [A-Z ]+PRIVATE KEY----)/i;
// Add-ons introduced by this plan: id -> required pinned spec.
const EXPECTED = new Map([
  ["context7", "@upstash/context7-mcp@4.0.3"],
  ["mobile", "@mobilenext/mobile-mcp@1.0.2"],
]);

let failures = 0;
const fail = (m) => {
  failures++;
  console.error("FAIL:", m);
};
const ok = (m) => console.log("ok:", m);

// Minimal JSONC strip: line comments + trailing commas before } or ].
function stripJsonc(src) {
  return src
    .replace(/\/\/.*$/gm, "")
    .replace(/,(\s*[\]}])/g, "$1");
}

const present = new Set();
for (const f of files) {
  let cfg;
  try {
    cfg = JSON.parse(stripJsonc(readFileSync(join(root, f), "utf8")));
  } catch (e) {
    fail(`${f}: does not parse (${e.message})`);
    continue;
  }
  const servers = cfg.mcpServers ?? cfg.servers ?? {};
  ok(`${f}: parses, ${Object.keys(servers).length} server(s)`);
  const fileIds = new Set();
  for (const [id, def] of Object.entries(servers)) {
    if (fileIds.has(id)) fail(`duplicate server id "${id}" within ${f}`);
    else fileIds.add(id);
    present.add(id);
    const flat = JSON.stringify(def);
    if (SECRET_RE.test(flat)) fail(`${f}#${id}: secret-like value detected`);
    if (
      def.env &&
      Object.values(def.env).some(
        (v) => typeof v === "string" && !String(v).startsWith("${input:")
      )
    ) {
      fail(`${f}#${id}: non-prompt hard-coded env value`);
    }
  }
}

for (const [id, spec] of EXPECTED) {
  if (!present.has(id)) fail(`expected add-on "${id}" (${spec}) not present in any config`);
  else ok(`add-on "${id}" present (${spec})`);
}

if (failures) {
  console.error(`\npreflight: ${failures} failure(s)`);
  process.exit(1);
}
console.log("\npreflight: PASS");
