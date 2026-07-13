#!/usr/bin/env node
// promote — the SOLE writer of PASS transitions. A candidate (FAIL/BLOCKED/live QUARANTINE)
// is promoted to PASS ONLY when its run store shows 5/5 passes across ≥2 distinct timestamps
// with a consistent asserts count (SCHEMA §6). 4/5, or 5/5 within one timestamp, is REFUSED.
// On success: writes STATUS=PASS, first-green-commit=<HEAD sha>, asserts=<count>, rechains.
// npm-world tooling per CLAUDE.md R3.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { parseLedger, chainDigest, priorState, selfTest, loadRunStore, windowVerdict } from "./lints/ledger-lint.mjs";

selfTest();

function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; }
const LEDGER = arg("--ledger");
const KEY = arg("--key");
if (!LEDGER || !KEY) { console.error("usage: promote.mjs --ledger <path> --key <path[::name]>"); process.exit(2); }
const DIR = dirname(LEDGER);
const ENV = process.env;

const refuse = (why) => { console.error(`REFUSE ${KEY}: ${why}`); process.exit(1); };

// ── load the (chained) run store ───────────────────────────────────────────────
function runStorePath() {
  return join(DIR, "runs", basename(LEDGER).replace(/\.tsv$/, ".runs.tsv"));
}
// the recorded runs for KEY, in append (chronological) order. loadRunStore parses + chain-
// verifies the store (same §4 resolution as ledgers); a missing/tampered store yields null.
function loadRuns(key) {
  const p = runStorePath();
  const byKey = loadRunStore(p, ENV);
  if (byKey === null) {
    if (!existsSync(p)) refuse(`no run store at ${p}`);
    refuse("run store has no valid #CHAIN trailer (tampered/missing evidence)");
  }
  return byKey.get(key) || [];
}

// ── the ledger + candidate row ─────────────────────────────────────────────────
const text = readFileSync(LEDGER, "utf8");
const parsed = parseLedger(text, basename(LEDGER));
if (!parsed.ok) refuse(`ledger fails lint before promotion:\n  ${parsed.errors.join("\n  ")}`);
const row = parsed.rows.find((r) => r.key === KEY);
if (!row) refuse("key not present in the ledger");
if (row.kind === "PASS") refuse("already PASS");
if (!["FAIL", "BLOCKED", "QUARANTINE"].includes(row.kind)) refuse(`status ${row.status} is not a promotable candidate`);

// ── the clean-window gate (SCHEMA §6, shared with ledger-lint's provenance) ─────
// A key promotes iff its LAST 5 run records are all pass, span ≥2 distinct timestamps, and
// agree on asserts. Ancient fails BEFORE that window do not block (B3). windowVerdict is the
// single source of truth both promote and lint use — they can never diverge.
const runs = loadRuns(KEY);
const v = windowVerdict(runs);
if (!v.ok) refuse(v.why);
const asserts = v.asserts;

// ── HEAD sha for first-green-commit ────────────────────────────────────────────
// A PASS row MUST carry a REAL 40-hex git sha (m4). No git AND no LEDGER_HEAD_SHA → REFUSE
// loudly rather than write the all-zeros sentinel the lint now bans as fake provenance.
function headSha() {
  try { return execFileSync("git", ["-C", DIR, "rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return ENV.LEDGER_HEAD_SHA || null; }
}
const commit = headSha();
if (!commit || !/^[0-9a-f]{40}$/.test(commit) || commit === "0".repeat(40))
  refuse(`cannot resolve a real first-green-commit (no git HEAD and no valid LEDGER_HEAD_SHA) — refusing to write fake all-zeros provenance`);

// ── write the PASS row + rechain (promote is the sole PASS writer) ──────────────
const escaped = KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rowRe = new RegExp("^(?:FAIL|BLOCKED\\([^)]*\\)|QUARANTINE\\([^)]*\\))\\t([ABC])\\t" + escaped + "\\t[^\\t]*\\t[^\\t]*\\t(.*)$", "m");
if (!rowRe.test(text)) refuse("could not locate the candidate row to rewrite");
const mutated = text.replace(rowRe, (_all, lane, note) => `PASS\t${lane}\t${KEY}\t${commit}\t${asserts}\t${note}`);

// reseal.
const reparsed = parseLedger(mutated, basename(LEDGER));
const prev = priorState(LEDGER).prevChain;
const sealed = reparsed.body + "#CHAIN " + chainDigest(prev, reparsed.body) + "\n";
writeFileSync(LEDGER, sealed);
console.log(`promote: ${KEY} → PASS (first-green ${commit.slice(0, 12)}…, asserts=${asserts}, clean window of ${v.window} across ${v.distinctTs} timestamps)`);
process.exit(0);
