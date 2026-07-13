// W1.7 RED g1: an illegal gift-lifecycle transition (found → filed, skipping `classified`)
// must fail gifts-lint. The finding's rows accumulate append-only; the latest-per-id walk
// hits a from→to edge (found→filed) that the state machine (§9.4 invariant 15) forbids.
// A control fixture (g3) proves the legal full lifecycle is accepted, so this failure is
// specifically the illegal edge, not a parse/chain artifact.
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const LINT = join(ROOT, "scripts", "lints", "gifts-lint.mjs");
const LEDGER = join(HERE, "g1-illegal-transition", "gifts.tsv");
const fails = [];

let code = 0, out = "";
try {
  out = execFileSync("node", [LINT, LEDGER], { encoding: "utf8" });
} catch (e) { code = e.status ?? 1; out = (e.stdout || "") + (e.stderr || ""); }

if (code === 0) fails.push(`lint passed an illegal transition found→filed (want nonzero); output:\n${out}`);
if (!/transition|illegal|classif/i.test(out)) fails.push(`lint failure did not mention the illegal transition; output:\n${out}`);

if (fails.length) {
  for (const f of fails) console.error("FAIL g1-illegal-transition: " + f);
  process.exit(1);
}
console.log("PASS g1-illegal-transition");
