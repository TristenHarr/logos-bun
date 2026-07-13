#!/usr/bin/env node
// bench/verify — the gate-side check L12 drives. Reads bench/LEDGER.json, recomputes every
// suite's integrity seal (a hand-edit that loosens a locked_ratio is caught here), and validates
// the metric taxonomy. EMPTY-SUITE GUARD: a ledger with no locked suites verifies trivially so
// the gate never blocks the honest "no benchmarks locked yet" bootstrap state (§9.1). Exit 0 =
// clean, nonzero = a broken lock. npm-world tooling per CLAUDE.md R3.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyLedger } from "./lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}
const LEDGER = arg("--ledger") || join(HERE, "LEDGER.json");

// A missing ledger is the pre-bootstrap state — treat it as the empty-suite guard (trivially ok).
if (!existsSync(LEDGER)) {
  console.log(`bench/verify: no ledger at ${LEDGER} — no locks yet, passes trivially`);
  process.exit(0);
}

let doc;
try {
  doc = JSON.parse(readFileSync(LEDGER, "utf8"));
} catch (e) {
  console.error(`bench/verify: ${LEDGER} is not valid JSON — ${e.message}`);
  process.exit(1);
}

const { ok, errors } = verifyLedger(doc);
if (!ok) {
  for (const e of errors) console.error(`bench/verify FAIL: ${e}`);
  process.exit(1);
}

const n = (doc.suites || []).length;
console.log(n === 0
  ? "bench/verify: empty suite set — no locks yet, passes trivially"
  : `bench/verify: ${n} locked suite(s) verified clean (integrity seals + metric taxonomy)`);
process.exit(0);
