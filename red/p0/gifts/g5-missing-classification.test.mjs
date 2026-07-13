// W1.7 RED g5: a finding may not leave `found` without a classification (§9.4 invariant 15 —
// triage before filing). The fixture's `classified` row carries `-` in the classification
// field → must fail gifts-lint. `found` alone may carry `-` (a just-recorded divergence is not
// yet triaged); every later state MUST be exactly one of ours|theirs|spec-ambiguity. g3 (the
// valid lifecycle) is the control that proves this fails for the missing classification, not a
// parse/chain artifact.
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const LINT = join(ROOT, "scripts", "lints", "gifts-lint.mjs");
const LEDGER = join(HERE, "g5-missing-classification", "gifts.tsv");
const fails = [];

let code = 0, out = "";
try {
  out = execFileSync("node", [LINT, LEDGER], { encoding: "utf8" });
} catch (e) { code = e.status ?? 1; out = (e.stdout || "") + (e.stderr || ""); }

if (code === 0) fails.push(`lint passed a classified-state row with no classification (want nonzero); output:\n${out}`);
if (!/classification/i.test(out)) fails.push(`lint failure did not name the missing classification; output:\n${out}`);

if (fails.length) {
  for (const f of fails) console.error("FAIL g5-missing-classification: " + f);
  process.exit(1);
}
console.log("PASS g5-missing-classification");
