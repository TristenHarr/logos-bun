// W1.1 RED f3: a hand-edited PASS row whose #CHAIN trailer was NOT recomputed must fail
// ledger-lint (§4 — the trailer is stale, lint recomputes sha256(prev‖body) and mismatches).
// The fixture's body was tampered (note "original"→"TAMPERED") while keeping the old trailer.
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const LINT = join(ROOT, "scripts", "lints", "ledger-lint.mjs");
const LEDGER = join(HERE, "f3-chain-broken", "ledger.tsv");
const fails = [];

let code = 0, out = "";
try {
  out = execFileSync("node", [LINT, LEDGER], {
    encoding: "utf8",
    env: { ...process.env, LEDGER_TODAY: "2026-07-13" },
  });
} catch (e) { code = e.status ?? 1; out = (e.stdout || "") + (e.stderr || ""); }

if (code === 0) fails.push(`lint passed a chain-broken (hand-edited) ledger (want nonzero); output:\n${out}`);
if (!/chain/i.test(out)) fails.push(`lint failure did not mention the chain mismatch; output:\n${out}`);

if (fails.length) {
  for (const f of fails) console.error("FAIL f3-chain-broken: " + f);
  process.exit(1);
}
console.log("PASS f3-chain-broken");
