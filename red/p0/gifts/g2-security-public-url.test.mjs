// W1.7 RED g2: a security=y finding may NEVER carry a public artifact link (github.com PR/
// issue URL) in ANY state before it is `filed` via security routing (§9.4 invariant 10). The
// fixture leaks a public issue URL on an `embargoed` row → must fail gifts-lint. The security
// embargo is the covenant's sharpest edge: a leak before coordinated disclosure is the exact
// failure we can never ship.
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const LINT = join(ROOT, "scripts", "lints", "gifts-lint.mjs");
const LEDGER = join(HERE, "g2-security-public-url", "gifts.tsv");
const fails = [];

let code = 0, out = "";
try {
  out = execFileSync("node", [LINT, LEDGER], { encoding: "utf8" });
} catch (e) { code = e.status ?? 1; out = (e.stdout || "") + (e.stderr || ""); }

if (code === 0) fails.push(`lint passed a security=y row carrying a public PR/issue URL (want nonzero); output:\n${out}`);
if (!/security|embargo|public/i.test(out)) fails.push(`lint failure did not mention the security embargo leak; output:\n${out}`);

if (fails.length) {
  for (const f of fails) console.error("FAIL g2-security-public-url: " + f);
  process.exit(1);
}
console.log("PASS g2-security-public-url");
