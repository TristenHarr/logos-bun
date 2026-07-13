#!/usr/bin/env node
// promote — the SOLE writer of PASS transitions. A candidate (FAIL/BLOCKED/live QUARANTINE)
// is promoted to PASS ONLY when its run store shows 5/5 passes across ≥2 distinct timestamps
// with a consistent asserts count (SCHEMA §6). 4/5, or 5/5 within one timestamp, is REFUSED.
// On success: writes STATUS=PASS, first-green-commit=<HEAD sha>, asserts=<count>, rechains.
// npm-world tooling per CLAUDE.md R3.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { parseLedger, chainDigest, priorState, selfTest } from "./lints/ledger-lint.mjs";

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
function loadRuns(key) {
  const p = runStorePath();
  if (!existsSync(p)) refuse(`no run store at ${p}`);
  const text = readFileSync(p, "utf8");
  // the run store is itself chained — verify it before trusting a single row (SCHEMA §6.1).
  const parsedTrailer = text.match(/\n#CHAIN ([0-9a-f]{64})\n$/);
  if (!parsedTrailer) refuse("run store has no #CHAIN trailer");
  const body = text.slice(0, text.length - ("#CHAIN " + parsedTrailer[1] + "\n").length);
  // the run store's prior state uses the same resolution as ledgers.
  const prev = priorState(p).prevChain;
  if (chainDigest(prev, body) !== parsedTrailer[1]) refuse("run store chain is invalid (tampered evidence)");
  const runs = [];
  for (const ln of body.split("\n")) {
    if (!ln || ln.startsWith("#")) continue;
    const [ts, k, verdict, asserts] = ln.split("\t");
    if (k === key) runs.push({ ts, verdict, asserts });
  }
  return runs;
}

// ── the ledger + candidate row ─────────────────────────────────────────────────
const text = readFileSync(LEDGER, "utf8");
const parsed = parseLedger(text, basename(LEDGER));
if (!parsed.ok) refuse(`ledger fails lint before promotion:\n  ${parsed.errors.join("\n  ")}`);
const row = parsed.rows.find((r) => r.key === KEY);
if (!row) refuse("key not present in the ledger");
if (row.kind === "PASS") refuse("already PASS");
if (!["FAIL", "BLOCKED", "QUARANTINE"].includes(row.kind)) refuse(`status ${row.status} is not a promotable candidate`);

// ── the 5/5-across-≥2-timestamps gate ──────────────────────────────────────────
const runs = loadRuns(KEY);
const passes = runs.filter((r) => r.verdict === "pass");
if (passes.length < 5) refuse(`only ${passes.length} recorded passes (need 5/5)`);
if (runs.some((r) => r.verdict === "fail")) refuse(`run store contains a fail for this key (need a clean 5/5, got ${passes.length} pass / ${runs.length} total)`);
const distinctTs = new Set(passes.map((r) => r.ts));
if (distinctTs.size < 2) refuse(`5 passes but only ${distinctTs.size} distinct timestamp(s) (need ≥2 — a single sitting admits ~5%-flaky tests)`);
const assertVals = new Set(passes.map((r) => r.asserts));
if (assertVals.size !== 1) refuse(`passing runs disagree on asserts count {${[...assertVals].join(", ")}} — cannot record a stable count`);
const asserts = [...assertVals][0];

// ── HEAD sha for first-green-commit ────────────────────────────────────────────
function headSha() {
  try { return execFileSync("git", ["-C", DIR, "rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return ENV.LEDGER_HEAD_SHA || "0".repeat(40); } // fixtures with no git → deterministic stub
}
const commit = headSha();

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
console.log(`promote: ${KEY} → PASS (first-green ${commit.slice(0, 12)}…, asserts=${asserts}, ${passes.length}/${runs.length} across ${distinctTs.size} timestamps)`);
process.exit(0);
