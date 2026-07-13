// W1.7 RED g4: a hand-edited gift row whose #CHAIN trailer was NOT recomputed must fail
// gifts-lint. The gift ledger reuses the W1.1 chain mechanism (SCHEMA §4) via ledger-lint's
// exported `chainDigest` — so gifts-lint recomputes sha256(prev‖body) and catches the stale
// trailer. The fixture's note was tampered ("original"→"TAMPERED") while keeping the old
// trailer, exactly the careless-edit case the chain exists to make loud.
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const LINT = join(ROOT, "scripts", "lints", "gifts-lint.mjs");
const LEDGER = join(HERE, "g4-chain-broken", "gifts.tsv");
const fails = [];

let code = 0, out = "";
try {
  out = execFileSync("node", [LINT, LEDGER], { encoding: "utf8" });
} catch (e) { code = e.status ?? 1; out = (e.stdout || "") + (e.stderr || ""); }

if (code === 0) fails.push(`lint passed a chain-broken (hand-edited) gift ledger (want nonzero); output:\n${out}`);
if (!/chain/i.test(out)) fails.push(`lint failure did not mention the chain mismatch; output:\n${out}`);

if (fails.length) {
  for (const f of fails) console.error("FAIL g4-chain-broken: " + f);
  process.exit(1);
}
console.log("PASS g4-chain-broken");
