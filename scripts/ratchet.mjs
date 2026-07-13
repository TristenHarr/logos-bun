#!/usr/bin/env node
// ratchet — replays the PASS set of a ledger. A PASS that fails runs a confirmatory re-run
// on the same shard: confirmed → exit nonzero + .merge-freeze marker + incident skeleton
// (repo frozen, row left for human triage); unconfirmed flake → auto-demote to
// QUARANTINE(expires=+14d) + incident + per-key .ratchet-break marker + rechain (repo open).
// SCHEMA.md §7 is the spec. npm-world tooling per CLAUDE.md R3.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { parseLedger, chainDigest, priorState, today, selfTest } from "./lints/ledger-lint.mjs";

selfTest();

// ── args ──────────────────────────────────────────────────────────────────────
function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}
const LEDGER = arg("--ledger");
if (!LEDGER) { console.error("usage: ratchet.mjs --ledger <path>"); process.exit(2); }
const DIR = dirname(LEDGER);
const ENV = process.env;

// ── verdict source: injected script (fixtures) or real `largo test` shards ─────
// Injected format (LEDGER_VERDICTS tsv): key ⇥ attempt ⇥ pass|fail.
function loadInjectedVerdicts() {
  const p = ENV.LEDGER_VERDICTS;
  if (!p || !existsSync(p)) return null;
  const map = new Map(); // key -> [verdict per attempt 1..n]
  for (const ln of readFileSync(p, "utf8").split("\n")) {
    if (!ln || ln.startsWith("#")) continue;
    const [key, attempt, verdict] = ln.split("\t");
    if (!map.has(key)) map.set(key, []);
    map.get(key)[Number(attempt) - 1] = verdict;
  }
  return map;
}
const injected = loadInjectedVerdicts();

function runVerdict(key, attempt) {
  if (injected) {
    const seq = injected.get(key);
    const v = seq && seq[attempt - 1];
    return v === "pass";
  }
  // real shard: `largo test <key>` — pass iff exit 0. (Wired at the toolchain pin.)
  try { execFileSync("largo", ["test", key], { stdio: "ignore" }); return true; }
  catch { return false; }
}

// ── date math for +14d (UTC, honoring LEDGER_TODAY) ────────────────────────────
function plusDays(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// ── incident + marker writers (mechanical §8/§9) ───────────────────────────────
function slug(key) { return key.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase(); }
function writeIncident(key, transition, timestamps) {
  const t = today(ENV);
  const dir = join(DIR, "conformance", "incidents");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${t}-${slug(key)}.md`);
  const body =
    `# incident ${t} — ${key}\n\n` +
    `key: ${key}\n` +
    `ledger: ${basename(LEDGER)}\n` +
    `transition: ${transition}\n` +
    `timestamps: ${timestamps.join(", ")}\n\n` +
    `## Resolution\n\n(TODO: fix the implementation, then revert this incident.)\n`;
  writeFileSync(file, body);
  return file;
}
function writeMarker(name, keys) {
  const dir = join(DIR, "conformance", "ledger");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), keys.length ? keys.map((k) => k).join("\n") + "\n" : "");
}

// ── reseal the ledger after a mutation (recompute the chain over the prior state) ─
function reseal(text) {
  const parsed = parseLedger(text, basename(LEDGER));
  const prev = priorState(LEDGER).prevChain;
  // body is the file minus the trailer; if there is no trailer, treat whole text as body.
  let body;
  if (parsed.trailer !== null) body = parsed.body;
  else body = text.endsWith("\n") ? text : text + "\n";
  const digest = chainDigest(prev, body);
  return body + "#CHAIN " + digest + "\n";
}

// ── main ───────────────────────────────────────────────────────────────────────
const text = readFileSync(LEDGER, "utf8");
const parsed = parseLedger(text, basename(LEDGER));
const passRows = parsed.rows.filter((r) => r.kind === "PASS");

let frozen = false;
let demoted = [];
const ts = today(ENV) + "T00:00:00Z";

for (const row of passRows) {
  const first = runVerdict(row.key, 1);
  if (first) continue;                         // still green
  const confirm = runVerdict(row.key, 2);      // confirmatory re-run on the same shard
  if (!confirm) {
    // CONFIRMED regression → freeze; leave the PASS row for human triage.
    writeMarker(".merge-freeze", [row.key]);
    writeIncident(row.key, "PASS→FAIL(frozen)", [ts, ts]);
    frozen = true;
  } else {
    // UNCONFIRMED flake → auto-demote to QUARANTINE(+14d), incident + per-key marker.
    demoted.push(row.key);
  }
}

if (demoted.length) {
  const exp = plusDays(today(ENV), 14);
  let lines = text.split("\n");
  lines = lines.map((ln) => {
    for (const key of demoted) {
      // rewrite the PASS row for this key: status→QUARANTINE, clear commit+asserts.
      const re = new RegExp("^PASS\\t([ABC])\\t" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\t[^\\t]*\\t[^\\t]*\\t(.*)$");
      const m = ln.match(re);
      if (m) return `QUARANTINE(expires=${exp})\t${m[1]}\t${key}\t-\t-\t${m[2]}`;
    }
    return ln;
  });
  const mutated = lines.join("\n");
  writeFileSync(LEDGER, reseal(mutated));
  writeMarker(".ratchet-break", demoted);
  for (const key of demoted) writeIncident(key, "PASS→QUARANTINE", [ts, ts]);
  console.log(`ratchet: demoted ${demoted.length} unconfirmed flake(s) to QUARANTINE(expires=${exp}) — repo stays open`);
}

if (frozen) {
  console.error("ratchet: CONFIRMED regression — merge freeze in effect (see .merge-freeze + incident)");
  process.exit(1);
}
console.log("ratchet: PASS set replayed clean" + (demoted.length ? " (after demotions)" : ""));
process.exit(0);
