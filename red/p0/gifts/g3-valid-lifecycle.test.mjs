// W1.7 RED g3: a valid full-lifecycle ledger must PASS gifts-lint. Two findings walk the
// complete state machine (§9.4 invariant 15): a `theirs` gift found→classified→ready→filed→
// in-review→merged→re-baselined, and a security=y finding taking the embargoed branch with
// NO public artifact link until it routes through security@bun.com. This is the positive
// control: it proves g1/g2 fail for their specific defect, not because the lint rejects all
// gift ledgers.
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const LINT = join(ROOT, "scripts", "lints", "gifts-lint.mjs");
const LEDGER = join(HERE, "g3-valid-lifecycle", "gifts.tsv");
const fails = [];

let code = 0, out = "";
try {
  out = execFileSync("node", [LINT, LEDGER], { encoding: "utf8" });
} catch (e) { code = e.status ?? 1; out = (e.stdout || "") + (e.stderr || ""); }

if (code !== 0) fails.push(`lint rejected a valid full-lifecycle gift ledger (want zero); output:\n${out}`);

if (fails.length) {
  for (const f of fails) console.error("FAIL g3-valid-lifecycle: " + f);
  process.exit(1);
}
console.log("PASS g3-valid-lifecycle");
