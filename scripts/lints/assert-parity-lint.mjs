#!/usr/bin/env node
// assert-parity-lint — the L5 gate check (W1.2). It enforces the assert ratchet the conformance
// runner's assert-count capture exists to power: once a key is committed PASS at asserts=N, its
// CURRENT recorded evidence (the most-recent verdict in the chained run store) may never drop
// below N. A test that quietly stops executing assertions — a refactor that deletes half its
// expects, or a body that gets `.skip`ped to green — keeps its PASS row but sheds its real
// evidence; L5 is the tripwire that turns that silent rot into a loud gate failure.
//
// It REUSES W1.1's ledger core (parseLedger/priorState/chainDigest from ledger-lint.mjs) — it
// does not reimplement the row grammar or the sha256 chain. Wired into gate.sh as `l5` in the
// l1/l2/l3 style (a tagged failure line `L5 assert-parity`, greppable by _ledger_gate).
//
// The check, per committed ledger:
//   • For each PASS row: promotion-time asserts = field 5 (a decimal ≥ 0, SCHEMA §2.2).
//   • Read runs/<name>.runs.tsv (independently chained, SCHEMA §6.1). Verify its chain first —
//     an unchained/tampered store yields NO trusted evidence, so L5 does not fire on it (that is
//     L1/L2-provenance's job; L5 never double-jeopardies a already-caught failure).
//   • For the PASS key, take the asserts of the MOST-RECENT timestamp's run (latest-wins: a drop
//     in the newest run is the regression even if older runs were high). Ties on ts → the last
//     row wins (append order is chronological within a ts).
//   • current < promotion-time ⇒ L5 FAIL. No run row for the key ⇒ no L5 check (NO-EVIDENCE is
//     L2-provenance's concern, not a parity drop).
// npm-world tooling per CLAUDE.md R3.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLedger, priorState, chainDigest, selfTest } from "./ledger-lint.mjs";

// the run-store path for a ledger (SCHEMA §6.1): <dir>/runs/<name>.runs.tsv.
function runStorePath(ledgerPath) {
  return join(dirname(ledgerPath), "runs", basename(ledgerPath).replace(/\.tsv$/, ".runs.tsv"));
}

// the current recorded asserts per key = the asserts of the latest-timestamp run for that key.
// Returns Map<key, number> ONLY for keys the (chain-verified) store actually records. A store
// whose own chain is invalid is untrusted → an empty map (L5 stays silent; L1 owns that failure).
function currentAsserts(ledgerPath) {
  const current = new Map();
  const p = runStorePath(ledgerPath);
  if (!existsSync(p)) return current;
  const text = readFileSync(p, "utf8");
  const parsed = parseLedger(text, basename(p));
  if (parsed.trailer === null) return current;
  const prev = priorState(p).prevChain;
  if (chainDigest(prev, parsed.body) !== parsed.trailer) return current; // untrusted store
  // group rows by key, keeping the row with the greatest ts (ties → last wins by append order).
  const latest = new Map(); // key -> { ts, asserts }
  for (const ln of parsed.body.split("\n")) {
    if (!ln || ln.startsWith("#")) continue;
    const [ts, key, , asserts] = ln.split("\t");
    if (ts === undefined || key === undefined || asserts === undefined) continue;
    const prevRow = latest.get(key);
    // latest-wins: strictly-greater ts replaces; equal ts also replaces (append order = chronology).
    if (!prevRow || ts >= prevRow.ts) latest.set(key, { ts, asserts });
  }
  for (const [key, { asserts }] of latest) {
    const n = Number(asserts);
    if (Number.isInteger(n) && n >= 0) current.set(key, n);
  }
  return current;
}

// the L5 check over one ledger file → array of error strings (empty = clean).
export function checkAssertParity(ledgerPath) {
  const errors = [];
  if (!existsSync(ledgerPath)) return errors;
  const parsed = parseLedger(readFileSync(ledgerPath, "utf8"), basename(ledgerPath));
  const current = currentAsserts(ledgerPath);
  for (const r of parsed.rows) {
    if (r.kind !== "PASS") continue;
    const promo = Number(r.asserts);
    if (!Number.isInteger(promo)) continue; // a malformed PASS asserts is L1's failure, not L5's
    const now = current.get(r.key);
    if (now === undefined) continue; // NO-EVIDENCE → not an L5 concern (L2-provenance owns it)
    if (now < promo)
      errors.push(`${basename(ledgerPath)}: L5 assert-parity — PASS key "${r.key}" recorded asserts=${now} dropped below its promotion-time value ${promo} (a proof cannot silently weaken)`);
  }
  return errors;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
function isMain() {
  return process.argv[1] && basename(process.argv[1]) === "assert-parity-lint.mjs";
}
if (isMain()) {
  selfTest();
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  let targets = args;
  if (targets.length === 0) {
    const ledgerDir = join(dirname(dirname(fileURLToPath(import.meta.url))), "..", "conformance", "ledger");
    if (existsSync(ledgerDir)) targets = readdirSync(ledgerDir).filter((f) => f.endsWith(".tsv")).map((f) => join(ledgerDir, f));
  }
  let fails = 0;
  for (const t of targets) {
    const errs = checkAssertParity(t);
    if (errs.length) { for (const e of errs) console.error("ASSERT-PARITY FAIL: " + e); fails += errs.length; }
    else console.log("assert-parity ok: " + basename(t));
  }
  process.exit(fails ? 1 : 0);
}
