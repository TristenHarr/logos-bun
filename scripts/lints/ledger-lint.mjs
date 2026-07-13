#!/usr/bin/env node
// ledger-lint — validates conformance/ledger/*.tsv against SCHEMA.md and wires the three
// gate checks L1 (chain), L2 (PASS-set monotonicity), L3 (expiry). This module is also the
// shared core (parse/chain/prior-state) imported by ratchet.mjs and promote.mjs — all ledger
// logic lives in exactly one place. npm-world tooling per CLAUDE.md R3; its RED drivers are
// shims allowlisted → W2.9.
//
// SCHEMA.md is the spec of record; this file is its executable form.
import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, basename } from "node:path";

// ── constants ────────────────────────────────────────────────────────────────
export const GENESIS = "0".repeat(64);
export const TRAILER_RE = /^#CHAIN ([0-9a-f]{64})$/;
const STATUS = {
  PASS: /^PASS$/,
  FAIL: /^FAIL$/,
  BLOCKED: /^BLOCKED\([A-Za-z][A-Za-z0-9]*\)$/,
  NOTIMPL: /^NOTIMPL$/,
  DIVERGE: /^DIVERGE\([^()\t\n]*[^()\t\n ][^()\t\n]*\)$/,
  QUARANTINE: /^QUARANTINE\(expires=(\d{4})-(\d{2})-(\d{2})\)$/,
};
const LANE_RE = /^[ABC]$/;
const SHA_RE = /^[0-9a-f]{40}$/;
const ASSERTS_RE = /^(0|[1-9][0-9]*)$/;

// ── low-level: chain over raw bytes ──────────────────────────────────────────
export function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}
// chain = sha256_hex(utf8(prev) ‖ body), prev fed as its 64 ASCII hex chars, body raw.
export function chainDigest(prev, body) {
  return sha256Hex(Buffer.concat([Buffer.from(prev, "utf8"), Buffer.from(body, "utf8")]));
}

// ── the status token classifier ──────────────────────────────────────────────
export function classifyStatus(tok) {
  for (const [kind, re] of Object.entries(STATUS)) {
    const m = tok.match(re);
    if (m) return { kind, m };
  }
  return null;
}

// strict proleptic-Gregorian date check (never `new Date(str)` — it rolls 02-30 over).
export function isRealDate(y, mo, d) {
  y = +y; mo = +mo; d = +d;
  if (mo < 1 || mo > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= dim[mo - 1];
}
// today (UTC) or the LEDGER_TODAY override; returned as a comparable YYYY-MM-DD string.
export function today(env = process.env) {
  if (env.LEDGER_TODAY) return env.LEDGER_TODAY;
  return new Date().toISOString().slice(0, 10);
}

// ── the parser: split a ledger file into {comments, rows, trailer, body} ──────
// Returns { ok, errors, rows: [{status,lane,key,commit,asserts,note, raw, lineno}], trailer, body }.
export function parseLedger(text, label = "ledger") {
  const errors = [];
  if (text.includes("\r")) errors.push(`${label}: contains CR — LF-only files only`);
  if (text.length > 0 && !text.endsWith("\n")) errors.push(`${label}: file must end in a newline`);

  const lines = text.length ? text.split("\n") : [];
  // split() on trailing \n leaves a final "" element — drop it (it's the terminator).
  if (lines.length && lines[lines.length - 1] === "") lines.pop();

  // locate the trailer: it MUST be the last line, matching TRAILER_RE.
  let trailer = null, trailerIdx = -1;
  if (lines.length) {
    const last = lines[lines.length - 1];
    const m = last.match(TRAILER_RE);
    if (m) { trailer = m[1]; trailerIdx = lines.length - 1; }
  }
  // ambiguity guard: no OTHER line may look like a trailer.
  lines.forEach((ln, i) => {
    if (i !== trailerIdx && TRAILER_RE.test(ln)) errors.push(`${label}:${i + 1}: stray #CHAIN-shaped line (only the last line may be the trailer)`);
  });
  if (trailer === null) errors.push(`${label}: missing #CHAIN trailer`);

  // body = every byte up to and including the \n before the trailer line.
  // Reconstruct from the original text so byte-exactness holds.
  let body = "";
  if (trailerIdx >= 0) {
    const trailerLine = "#CHAIN " + trailer + "\n";
    if (!text.endsWith(trailerLine)) errors.push(`${label}: trailer line is not byte-exact ("#CHAIN " + 64hex + "\\n")`);
    body = text.slice(0, text.length - trailerLine.length);
  }

  const rows = [];
  const bodyLines = trailerIdx >= 0 ? lines.slice(0, trailerIdx) : lines;
  let sawRow = false;
  bodyLines.forEach((ln, i) => {
    const lineno = i + 1;
    if (ln === "") {
      // blank lines are only tolerated as part of a leading comment run; once a row has
      // been seen, an interstitial blank is INVALID (canonical form, §1).
      if (sawRow) errors.push(`${label}:${lineno}: interstitial blank line (canonical form forbids blanks between rows)`);
      return;
    }
    if (ln.startsWith("#")) return; // comment
    sawRow = true;
    // split by TAB into exactly 6 fields.
    const fields = ln.split("\t");
    if (fields.length !== 6) { errors.push(`${label}:${lineno}: ${fields.length} fields (want 6 TAB-separated)`); return; }
    const [status, lane, key, commit, asserts, note] = fields;
    const cls = classifyStatus(status);
    if (!cls) errors.push(`${label}:${lineno}: bad STATUS token "${status}"`);
    if (!LANE_RE.test(lane)) errors.push(`${label}:${lineno}: bad LANE "${lane}" (want A|B|C)`);
    if (key.length === 0) errors.push(`${label}:${lineno}: empty key`);
    // date reality for QUARANTINE.
    if (cls && cls.kind === "QUARANTINE" && !isRealDate(cls.m[1], cls.m[2], cls.m[3]))
      errors.push(`${label}:${lineno}: QUARANTINE has an unreal date ${cls.m[1]}-${cls.m[2]}-${cls.m[3]}`);
    // PASS invariants vs non-PASS.
    const isPass = cls && cls.kind === "PASS";
    if (isPass) {
      if (!SHA_RE.test(commit)) errors.push(`${label}:${lineno}: PASS needs a lowercase 40-hex first-green-commit, got "${commit}"`);
      if (!ASSERTS_RE.test(asserts)) errors.push(`${label}:${lineno}: PASS needs a decimal asserts (no leading zeros), got "${asserts}"`);
    } else if (cls) {
      if (commit !== "-") errors.push(`${label}:${lineno}: non-PASS must carry "-" in first-green-commit, got "${commit}"`);
      if (asserts !== "-") errors.push(`${label}:${lineno}: non-PASS must carry "-" in asserts, got "${asserts}"`);
    }
    rows.push({ status, lane, key, commit, asserts, note, kind: cls ? cls.kind : null, qmatch: cls && cls.kind === "QUARANTINE" ? cls.m : null, lineno, raw: ln });
  });

  // uniqueness + coarse/fine key collision.
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.key)) errors.push(`${label}: duplicate key "${r.key}"`);
    seen.add(r.key);
  }
  for (const r of rows) {
    const idx = r.key.indexOf("::");
    if (idx >= 0) {
      const base = r.key.slice(0, idx);
      if (seen.has(base)) errors.push(`${label}: coarse/fine key collision — both "${base}" and "${r.key}" present`);
    }
  }

  return { ok: errors.length === 0, errors, rows, trailer, body };
}

// ── prior-state resolution (SCHEMA §4): snapshot > git HEAD > GENESIS ─────────
// Returns { prevChain, passSet: Map<key, {asserts}> } from the prior committed state.
export function priorState(ledgerPath) {
  const snap = ledgerPath + ".head";
  let text = null;
  if (existsSync(snap)) {
    text = readFileSync(snap, "utf8");
  } else {
    try {
      // repo root of the ledger file, so `git show HEAD:<relpath>` resolves.
      const repoRoot = execFileSync("git", ["-C", dirname(ledgerPath), "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      const rel = ledgerPath.startsWith(repoRoot + "/") ? ledgerPath.slice(repoRoot.length + 1) : basename(ledgerPath);
      text = execFileSync("git", ["-C", repoRoot, "show", `HEAD:${rel}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      text = null; // any nonzero exit = no prior state (SCHEMA §4 step 2).
    }
  }
  if (text === null) return { prevChain: GENESIS, passSet: new Map() };
  const parsed = parseLedger(text, "prior");
  const passSet = new Map();
  for (const r of parsed.rows) if (r.kind === "PASS") passSet.set(r.key, { asserts: r.asserts });
  return { prevChain: parsed.trailer ?? GENESIS, passSet };
}

// ── L1: chain validity ───────────────────────────────────────────────────────
export function checkChain(ledgerPath, parsed, prev) {
  const errors = [];
  if (parsed.trailer === null) return [`${basename(ledgerPath)}: L1 chain — no trailer to verify`];
  const want = chainDigest(prev, parsed.body);
  if (parsed.trailer !== want) errors.push(`${basename(ledgerPath)}: L1 chain mismatch — trailer ${parsed.trailer.slice(0, 12)}… != recomputed ${want.slice(0, 12)}… (stale/hand-edited body)`);
  return errors;
}

// ── L2: PASS-set monotonicity + transition law ───────────────────────────────
export function checkMonotone(ledgerPath, parsed, prior, env = process.env) {
  const errors = [];
  const dir = dirname(ledgerPath);
  const ledgerDir = dir; // markers/incidents live under conformance/ledger|incidents rooted here or above
  const authorizedKeys = readRatchetBreak(ledgerDir);
  const incidents = readIncidents(ledgerDir);
  const workPass = new Map();
  for (const r of parsed.rows) if (r.kind === "PASS") workPass.set(r.key, r);

  for (const [key, info] of prior.passSet) {
    const now = workPass.get(key);
    if (!now) {
      // baseline PASS dropped/downgraded → ratchet-break required (incident names key + marker lists key).
      if (!(authorizedKeys.has(key) && incidents.has(key)))
        errors.push(`${basename(ledgerPath)}: L2 monotonicity — PASS key "${key}" dropped/downgraded without an incident + per-key .ratchet-break marker`);
    } else {
      // stable PASS: asserts must not decrease.
      if (Number(now.asserts) < Number(info.asserts))
        errors.push(`${basename(ledgerPath)}: L2 monotonicity — PASS key "${key}" asserts shrank ${info.asserts} → ${now.asserts}`);
    }
  }

  // NEW-KEY PASS must be backed by run-store evidence — the chain alone cannot stop a
  // hand-planted PASS on a fresh key (invisible to monotonicity). SCHEMA §5 last bullet.
  const proven = provenPassKeys(ledgerPath);
  for (const [key, r] of workPass) {
    if (prior.passSet.has(key)) continue;                 // not new — handled above
    const ev = proven.get(key);
    if (!ev)
      errors.push(`${basename(ledgerPath)}: L2 provenance — new PASS key "${key}" has no 5/5-across-≥2-timestamps evidence in the run store (hand-planted PASS?)`);
    else if (ev.asserts !== r.asserts)
      errors.push(`${basename(ledgerPath)}: L2 provenance — PASS key "${key}" asserts=${r.asserts} disagrees with run-store evidence asserts=${ev.asserts}`);
  }
  return errors;
}

// keys that the (chained) run store proves are promotable: 5/5 passes, ≥2 distinct
// timestamps, consistent asserts. Absent/tampered store → no proven keys.
function provenPassKeys(ledgerPath) {
  const proven = new Map();
  const runPath = join(dirname(ledgerPath), "runs", basename(ledgerPath).replace(/\.tsv$/, ".runs.tsv"));
  if (!existsSync(runPath)) return proven;
  const text = readFileSync(runPath, "utf8");
  const parsed = parseLedger(text, basename(runPath));
  if (parsed.trailer === null) return proven;
  // verify the run store's own chain (tamper-evidence, §6.1).
  const prev = priorState(runPath).prevChain;
  if (chainDigest(prev, parsed.body) !== parsed.trailer) return proven;
  // group its raw rows (run store rows are ts⇥key⇥verdict⇥asserts, not ledger rows).
  const byKey = new Map();
  for (const ln of parsed.body.split("\n")) {
    if (!ln || ln.startsWith("#")) continue;
    const [ts, key, verdict, asserts] = ln.split("\t");
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ ts, verdict, asserts });
  }
  for (const [key, runs] of byKey) {
    const passes = runs.filter((r) => r.verdict === "pass");
    if (passes.length < 5) continue;
    if (runs.some((r) => r.verdict === "fail")) continue;
    if (new Set(passes.map((r) => r.ts)).size < 2) continue;
    const av = new Set(passes.map((r) => r.asserts));
    if (av.size !== 1) continue;
    proven.set(key, { asserts: [...av][0] });
  }
  return proven;
}

// read the per-key .ratchet-break marker (one authorized key per line) if present.
function readRatchetBreak(startDir) {
  const p = findUp(startDir, join("conformance", "ledger", ".ratchet-break"));
  const keys = new Set();
  if (p && existsSync(p)) for (const ln of readFileSync(p, "utf8").split("\n")) { const k = ln.trim(); if (k) keys.add(k); }
  return keys;
}
// read all incident files and collect keys they name (via a `key: <k>` line or a raw substring).
function readIncidents(startDir) {
  const p = findUp(startDir, join("conformance", "incidents"));
  const keys = new Set();
  if (p && existsSync(p)) {
    for (const f of readdirSync(p)) {
      if (!f.endsWith(".md")) continue;
      const body = readFileSync(join(p, f), "utf8");
      for (const ln of body.split("\n")) { const m = ln.match(/^key:\s*(.+?)\s*$/); if (m) keys.add(m[1]); }
    }
  }
  return keys;
}
// walk up from `startDir` looking for a directory/file at the given relative path.
function findUp(startDir, rel) {
  let d = startDir;
  for (let i = 0; i < 8; i++) {
    const cand = join(d, rel);
    if (existsSync(cand)) return cand;
    // also try treating startDir as if it already contains conformance/
    const up = dirname(d);
    if (up === d) break;
    d = up;
  }
  // last resort: the marker/incident dir may be a sibling of the ledger (fixture layout).
  return join(startDir, rel);
}

// committed-marker ban: a marker present in git HEAD is a lint fail (§9). Working-tree only.
export function checkMarkersNotCommitted(ledgerPath) {
  const errors = [];
  const dir = dirname(ledgerPath);
  let repoRoot;
  try { repoRoot = execFileSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return errors; } // not in a git repo (fixture temp dir) — nothing to check
  for (const marker of ["conformance/ledger/.ratchet-break", "conformance/ledger/.merge-freeze"]) {
    try {
      execFileSync("git", ["-C", repoRoot, "cat-file", "-e", `HEAD:${marker}`], { stdio: "ignore" });
      errors.push(`L9 markers — ${marker} is committed at HEAD (markers must be working-tree only / gitignored)`);
    } catch { /* absent at HEAD = good */ }
  }
  return errors;
}

// ── L3: expiry enforcement (pure-local, no git) ──────────────────────────────
export function checkExpiry(ledgerPath, parsed, env = process.env) {
  const errors = [];
  const t = today(env);
  for (const r of parsed.rows) {
    if (r.kind !== "QUARANTINE") continue;
    const exp = `${r.qmatch[1]}-${r.qmatch[2]}-${r.qmatch[3]}`;
    // expired = expires < today; expires == today is still LIVE.
    if (exp < t) errors.push(`${basename(ledgerPath)}:${r.lineno}: L3 expiry — QUARANTINE expired (expires=${exp} < today=${t})`);
  }
  return errors;
}

// ── the full lint over one ledger file ───────────────────────────────────────
export function lintFile(ledgerPath, env = process.env) {
  const errors = [];
  if (!existsSync(ledgerPath)) return [`${ledgerPath}: no such ledger`];
  const text = readFileSync(ledgerPath, "utf8");
  const parsed = parseLedger(text, basename(ledgerPath));
  errors.push(...parsed.errors);
  const prior = priorState(ledgerPath);
  errors.push(...checkChain(ledgerPath, parsed, prior.prevChain)); // L1
  errors.push(...checkMonotone(ledgerPath, parsed, prior, env));   // L2
  errors.push(...checkExpiry(ledgerPath, parsed, env));            // L3
  errors.push(...checkMarkersNotCommitted(ledgerPath));            // §9
  return errors;
}

// self-test of the sha256 wiring against the pinned genesis vector (SCHEMA §4).
export function selfTest() {
  const got = chainDigest(GENESIS, "");
  const want = "60e05bd1b195af2f94112fa7197a5c88289058840ce7c6df9693756bc6250f55";
  if (got !== want) throw new Error(`ledger-lint self-test FAILED: genesis vector ${got} != ${want}`);
}

// ── CLI ──────────────────────────────────────────────────────────────────────
function isMain() {
  return process.argv[1] && (process.argv[1].endsWith("ledger-lint.mjs"));
}
if (isMain()) {
  selfTest();
  const args = process.argv.slice(2);
  let targets = args.filter((a) => !a.startsWith("--"));
  if (targets.length === 0) {
    // default: every conformance/ledger/*.tsv from the repo root of THIS script.
    const ledgerDir = join(dirname(dirname(new URL(import.meta.url).pathname)), "..", "conformance", "ledger");
    if (existsSync(ledgerDir)) targets = readdirSync(ledgerDir).filter((f) => f.endsWith(".tsv")).map((f) => join(ledgerDir, f));
  }
  let fails = 0;
  for (const t of targets) {
    const errs = lintFile(t, process.env);
    if (errs.length) { for (const e of errs) console.error("LEDGER-LINT FAIL: " + e); fails += errs.length; }
    else console.log("ledger-lint ok: " + basename(t));
  }
  process.exit(fails ? 1 : 0);
}
