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
      else if (commit === "0".repeat(40)) errors.push(`${label}:${lineno}: PASS first-green-commit is the all-zeros sentinel — a real git sha is required (fake provenance)`);
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

// robustly resolve the repo-relative path of a ledger file, regardless of whether the caller
// passed an ABSOLUTE or a RELATIVE path (review-2 BLOCKER-A / M1). `git -C <dir> rev-parse
// --show-prefix` gives the dir's path from the repo root (empty at the root, else
// "sub/dir/"); append the basename to name the blob. Returns { repoRoot, rel } or null when
// the file is not inside a git work tree (fixture temp dir).
export function gitRelPath(ledgerPath) {
  try {
    const dir = dirname(ledgerPath);
    const repoRoot = execFileSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const prefix = execFileSync("git", ["-C", dir, "rev-parse", "--show-prefix"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return { repoRoot, rel: prefix + basename(ledgerPath) };
  } catch { return null; }
}

// read the prior committed VERSION of a ledger from git HEAD, via the correct relpath. Honors
// LEDGER_LINT_BASELINE, which names a conformance/ledger/<name>.tsv whose HEAD blob is the
// baseline even when the working file is absent (vanished-ledger enumeration, review-1 FINDING 2).
// Returns the file text, or null on any nonzero exit / not-in-git (SCHEMA §4 step 2).
function gitHeadText(ledgerPath, env = process.env) {
  const g = gitRelPath(ledgerPath);
  if (!g) return null;
  const rel = env.LEDGER_LINT_BASELINE ? "conformance/ledger/" + env.LEDGER_LINT_BASELINE : g.rel;
  try {
    return execFileSync("git", ["-C", g.repoRoot, "show", `HEAD:${rel}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch { return null; }
}

// the monotonicity BASELINE rows (SCHEMA §5): the .head snapshot if present, else the git HEAD
// version (via the correct relpath), else empty. This is the ONLY place git HEAD is read for a
// ledger, and only for the PASS baseline + transition table — never for the chain (that would
// re-derive the file's OWN committed trailer for an unchanged file = the self-fixed-point of
// review-1 F1). Returns Map<key, {kind, asserts}> over ALL baseline rows (not just PASS), so the
// transition law (§5 table) can compare a non-PASS baseline row to its working-tree successor.
function baselineRows(ledgerPath, env = process.env) {
  const snap = ledgerPath + ".head";
  const text = existsSync(snap) ? readFileSync(snap, "utf8") : gitHeadText(ledgerPath, env);
  const rows = new Map();
  if (text === null) return rows;
  const parsed = parseLedger(text, "baseline");
  for (const r of parsed.rows) rows.set(r.key, { kind: r.kind, asserts: r.asserts });
  return rows;
}

// ── prior-state resolution (SCHEMA §4/§5) ─────────────────────────────────────
// Returns { prevChain, passSet }. The two faces are RESOLVED FROM DIFFERENT SOURCES on purpose:
//   • prevChain (the sealing/L1 input): the `<name>.tsv.head` snapshot's trailer if present,
//     else GENESIS. It is NEVER the file's own git-HEAD trailer — for a committed unchanged
//     ledger `git show HEAD:<self>` returns the file's CURRENT trailer, and hashing a file's
//     own trailer into its own chain is an unsatisfiable fixed point (review-1 FINDING 1). The
//     chain is therefore an accidental-edit tripwire keyed to a FIXED genesis (or a controlled
//     fixture `.head`), exactly as SCHEMA §0 now states — not a per-commit cryptographic chain.
//   • passSet (the L2 monotonicity baseline): the `.head` snapshot if present, else the git
//     HEAD version via the CORRECT relpath (works for absolute AND relative invocations — the
//     old basename fallback silently wiped the baseline on a relative path, review-2 BLOCKER-A).
// This split is what makes a committed unchanged ledger PASS L1 while STILL enforcing that its
// committed PASS set cannot silently shrink. Consumers (promote/ratchet/gifts/assert-parity)
// import this and read only `.prevChain` for sealing — the signature is unchanged.
export function priorState(ledgerPath, env = process.env) {
  const snap = ledgerPath + ".head";
  let prevChain = GENESIS;
  if (existsSync(snap)) {
    const parsed = parseLedger(readFileSync(snap, "utf8"), "prior");
    prevChain = parsed.trailer ?? GENESIS;
  }
  const baseline = baselineRows(ledgerPath, env);
  const passSet = new Map();
  for (const [key, info] of baseline) if (info.kind === "PASS") passSet.set(key, { asserts: info.asserts });
  return { prevChain, passSet, baseline };
}

// ── L1: chain validity ───────────────────────────────────────────────────────
export function checkChain(ledgerPath, parsed, prev) {
  const errors = [];
  if (parsed.trailer === null) return [`${basename(ledgerPath)}: L1 chain — no trailer to verify`];
  const want = chainDigest(prev, parsed.body);
  if (parsed.trailer !== want) errors.push(`${basename(ledgerPath)}: L1 chain mismatch — trailer ${parsed.trailer.slice(0, 12)}… != recomputed ${want.slice(0, 12)}… (stale/hand-edited body)`);
  return errors;
}

// The forbidden non-PASS baseline transitions (SCHEMA §5 table; PASS-row shrinks are handled by
// monotonicity/provenance above, not here). Value = the set of to-statuses (plus "deleted") that
// the from-status may NEVER take. FAIL/BLOCKED/QUARANTINE transition freely to any non-PASS.
const FORBIDDEN_TRANSITION = {
  // DIVERGE is a permanent stance: it never transitions to anything (to PASS/FAIL/…/deleted).
  DIVERGE: new Set(["PASS", "FAIL", "BLOCKED", "NOTIMPL", "QUARANTINE", "deleted"]),
  // NOTIMPL may only implement/prove → FAIL or PASS, or be deleted; the rest are forbidden.
  NOTIMPL: new Set(["BLOCKED", "DIVERGE", "QUARANTINE"]),
};
function toStatusKind(row) { return row ? (row.kind || "bad") : "deleted"; }

// ── L2: PASS-set monotonicity + transition law ───────────────────────────────
export function checkMonotone(ledgerPath, parsed, prior, env = process.env) {
  const errors = [];
  const dir = dirname(ledgerPath);
  const ledgerDir = dir; // markers/incidents live under conformance/ledger|incidents rooted here or above
  const authorizedKeys = readRatchetBreak(ledgerDir);
  const incidents = readIncidents(ledgerDir, basename(ledgerPath));
  const workPass = new Map();
  const workRows = new Map();
  for (const r of parsed.rows) {
    workRows.set(r.key, r);
    if (r.kind === "PASS") workPass.set(r.key, r);
  }

  for (const [key, info] of prior.passSet) {
    const now = workPass.get(key);
    if (!now) {
      // baseline PASS dropped/downgraded → ratchet-break required. The incident must name the
      // key AND be coupled to a real PASS→ transition on THIS ledger; the marker must list it.
      const to = toStatusKind(workRows.get(key));
      if (!(authorizedKeys.has(key) && incidents.has(key)))
        errors.push(`${basename(ledgerPath)}: L2 monotonicity — PASS key "${key}" dropped/downgraded (PASS→${to}) without an incident (naming this key + ledger + a PASS→ transition) + per-key .ratchet-break marker`);
    } else {
      // stable PASS: asserts must not decrease.
      if (Number(now.asserts) < Number(info.asserts))
        errors.push(`${basename(ledgerPath)}: L2 monotonicity — PASS key "${key}" asserts shrank ${info.asserts} → ${now.asserts}`);
    }
  }

  // Transition law for NON-PASS baseline rows (SCHEMA §5 table). A DIVERGE that flips to FAIL,
  // or a NOTIMPL that jumps straight to QUARANTINE, is forbidden even though neither touches the
  // PASS set — without this the table would be decorative for non-PASS rows (review-1 FINDING 4).
  for (const [key, info] of prior.baseline) {
    if (info.kind === "PASS") continue;                    // PASS-row transitions handled above
    const forbidden = FORBIDDEN_TRANSITION[info.kind];
    if (!forbidden) continue;                              // FAIL/BLOCKED/QUARANTINE transition freely
    const to = toStatusKind(workRows.get(key));
    if (to === info.kind) continue;                        // unchanged (same status) is always fine
    if (forbidden.has(to))
      errors.push(`${basename(ledgerPath)}: L2 transition — ${info.kind} key "${key}" may not transition ${info.kind}→${to} (SCHEMA §5 forbids it)`);
  }

  // NEW-KEY PASS must be backed by run-store evidence — the chain alone cannot stop a
  // hand-planted PASS on a fresh key (invisible to monotonicity). SCHEMA §5 last bullet.
  const proven = provenPassKeys(ledgerPath, env);
  for (const [key, r] of workPass) {
    if (prior.passSet.has(key)) continue;                 // not new — handled above
    const ev = proven.get(key);
    if (!ev)
      errors.push(`${basename(ledgerPath)}: L2 provenance — new PASS key "${key}" has no clean-window (last 5 runs pass, ≥2 timestamps) evidence in the run store (hand-planted PASS?)`);
    else if (ev.asserts !== r.asserts)
      errors.push(`${basename(ledgerPath)}: L2 provenance — PASS key "${key}" asserts=${r.asserts} disagrees with run-store evidence asserts=${ev.asserts}`);
  }
  return errors;
}

// the run-store timestamp format is pinned: `YYYY-MM-DDThh:mm:ssZ` (SCHEMA §6.1). Sub-second
// variants (`…T00:00:00.000Z`) are REJECTED so `…Z` vs `…000Z` can never count as 2 distinct
// timestamps (review-2 MAJOR-C). The date + wall-clock fields must both be real.
export const RUN_TS_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;
export function isRealRunTs(ts) {
  const m = String(ts).match(RUN_TS_RE);
  if (!m) return false;
  if (!isRealDate(m[1], m[2], m[3])) return false;
  const [hh, mi, ss] = [+m[4], +m[5], +m[6]];
  return hh <= 23 && mi <= 59 && ss <= 59;
}

// the promotion window (SCHEMA §6): a key is promotable iff its LAST 5 run records (append order
// = chronological) are ALL `pass`, span ≥2 DISTINCT timestamps, and agree on asserts. Ancient
// fails BEFORE that clean window do not block (blast B3 — frontier keys accrue fails in normal
// dev, so whole-history "must be clean" made them un-promotable). Structural guards (MAJOR-C):
// every run's verdict ∈ {pass, fail} (a `skip`/`error`/empty verdict is a fail-in-disguise →
// disqualifies the window loudly) and every ts is a pinned, real `YYYY-MM-DDThh:mm:ssZ`.
export const PROMOTE_WINDOW = 5;
export function windowVerdict(runs) {
  if (runs.length < PROMOTE_WINDOW) return { ok: false, why: `only ${runs.length} recorded runs (need a clean window of ${PROMOTE_WINDOW})` };
  const win = runs.slice(-PROMOTE_WINDOW);           // the last N in append (chronological) order
  for (const r of win) {
    if (r.verdict !== "pass" && r.verdict !== "fail")
      return { ok: false, why: `run has verdict "${r.verdict}" (only {pass,fail} are valid — a skip/error/empty is a fail-in-disguise)` };
    if (!isRealRunTs(r.ts))
      return { ok: false, why: `run timestamp "${r.ts}" is not a real pinned YYYY-MM-DDThh:mm:ssZ instant` };
  }
  if (!win.every((r) => r.verdict === "pass"))
    return { ok: false, why: `the last ${PROMOTE_WINDOW} runs are not all pass (window: ${win.map((r) => r.verdict).join(",")})` };
  const distinctTs = new Set(win.map((r) => r.ts));
  if (distinctTs.size < 2) return { ok: false, why: `the ${PROMOTE_WINDOW}-pass window spans only ${distinctTs.size} distinct timestamp(s) (need ≥2 — a single sitting admits a ~5%-flaky test)` };
  const av = new Set(win.map((r) => r.asserts));
  if (av.size !== 1) return { ok: false, why: `the passing window disagrees on asserts {${[...av].join(", ")}}` };
  return { ok: true, asserts: [...av][0], distinctTs: distinctTs.size, window: win.length };
}

// parse + chain-verify a run store, grouping its rows by key in append order. Returns
// Map<key, [{ts,verdict,asserts}]> or null on missing / no-trailer / broken-chain (untrusted).
export function loadRunStore(runPath, env = process.env) {
  if (!existsSync(runPath)) return null;
  const text = readFileSync(runPath, "utf8");
  const parsed = parseLedger(text, basename(runPath));
  if (parsed.trailer === null) return null;
  const prev = priorState(runPath, env).prevChain;   // run store uses the same §4 chain
  if (chainDigest(prev, parsed.body) !== parsed.trailer) return null;
  const byKey = new Map();
  for (const ln of parsed.body.split("\n")) {
    if (!ln || ln.startsWith("#")) continue;
    const [ts, key, verdict, asserts] = ln.split("\t");
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ ts, verdict, asserts });
  }
  return byKey;
}

// keys the (chained) run store proves promotable, via the clean-window rule (SCHEMA §6).
// Absent/tampered store → no proven keys.
function provenPassKeys(ledgerPath, env = process.env) {
  const proven = new Map();
  const runPath = join(dirname(ledgerPath), "runs", basename(ledgerPath).replace(/\.tsv$/, ".runs.tsv"));
  const byKey = loadRunStore(runPath, env);
  if (!byKey) return proven;
  for (const [key, runs] of byKey) {
    const v = windowVerdict(runs);
    if (v.ok) proven.set(key, { asserts: v.asserts });
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
// read incident files and collect the keys whose PASS→ drop they AUTHORIZE for THIS ledger. An
// incident authorizes a drop only when it (a) names the exact `key:`, (b) references THIS
// `ledger:` (basename), and (c) records a `transition:` that begins `PASS→` (§8). The `key:`
// header match is CASE-INSENSITIVE (`Key:`/`KEY:` accepted). This closes m2's two-sided gap: an
// unrelated/stale incident that merely mentions `key: <k>` for another ledger or a non-PASS
// transition no longer authorizes dropping <k>. `#`-leading keys are preserved verbatim (the
// header value is taken literally, not treated as a comment).
function readIncidents(startDir, ledgerBase) {
  const p = findUp(startDir, join("conformance", "incidents"));
  const keys = new Set();
  if (p && existsSync(p)) {
    for (const f of readdirSync(p)) {
      if (!f.endsWith(".md")) continue;
      const body = readFileSync(join(p, f), "utf8");
      let key = null, ledger = null, transition = null;
      for (const ln of body.split("\n")) {
        let m;
        if ((m = ln.match(/^key:\s*(.+?)\s*$/i))) key = m[1];
        else if ((m = ln.match(/^ledger:\s*(.+?)\s*$/i))) ledger = m[1];
        else if ((m = ln.match(/^transition:\s*(.+?)\s*$/i))) transition = m[1];
      }
      if (!key) continue;
      // couple: the incident must name THIS ledger and a PASS→ transition to authorize the drop.
      if (ledger !== null && basename(ledger) !== ledgerBase) continue;
      if (transition !== null && !/^PASS→/.test(transition)) continue;
      keys.add(key);
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

// committed-marker ban: a marker OR a `.tsv.head` prior-state snapshot present in git HEAD is a
// lint fail (§9 markers + M2 .head ban). All three are working-tree-only seams — a committed one
// lets anyone forge the monotonicity baseline or unlock demotions permanently. Working-tree only.
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
  // ban any committed *.tsv.head snapshot under conformance/ledger/ (the .head seam supplies BOTH
  // prev_chain AND the PASS baseline; a committed one forges a shrunk baseline — review-2 BLOCKER-B).
  try {
    const listed = execFileSync("git", ["-C", repoRoot, "ls-tree", "-r", "--name-only", "HEAD", "conformance/ledger/"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    for (const name of listed.split("\n")) {
      if (name.endsWith(".tsv.head")) errors.push(`L9 markers — ${name} is committed at HEAD (a .head prior-state snapshot must be working-tree only / gitignored)`);
    }
  } catch { /* no HEAD / empty tree = nothing committed */ }
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

// structural lint for a run store (`runs/<name>.runs.tsv`, SCHEMA §6.1). Its rows are 4-field
// (ts ⇥ key ⇥ verdict ⇥ asserts), NOT 6-field ledger rows, so it gets its own checks: LF-only,
// final newline, exactly one #CHAIN trailer, a valid chain, and per-row field count / verdict /
// ts / asserts grammar. Wired into the lint's default targets + the gate glob (m3/MAJOR-C) so a
// malformed or chain-broken store reds the gate by default, not only when a promote touches it.
export function lintRunStore(runPath, env = process.env) {
  const errors = [];
  if (!existsSync(runPath)) return errors;
  const label = basename(runPath);
  const text = readFileSync(runPath, "utf8");
  if (text.includes("\r")) errors.push(`${label}: run store contains CR — LF-only`);
  if (text.length > 0 && !text.endsWith("\n")) errors.push(`${label}: run store must end in a newline`);
  const lines = text.length ? text.split("\n") : [];
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  let trailer = null, trailerIdx = -1;
  if (lines.length) { const m = lines[lines.length - 1].match(TRAILER_RE); if (m) { trailer = m[1]; trailerIdx = lines.length - 1; } }
  lines.forEach((ln, i) => { if (i !== trailerIdx && TRAILER_RE.test(ln)) errors.push(`${label}:${i + 1}: stray #CHAIN-shaped line`); });
  if (trailer === null) { errors.push(`${label}: missing #CHAIN trailer`); return errors; }
  const trailerLine = "#CHAIN " + trailer + "\n";
  if (!text.endsWith(trailerLine)) errors.push(`${label}: trailer line not byte-exact`);
  const body = text.slice(0, text.length - trailerLine.length);
  const prev = priorState(runPath, env).prevChain;
  if (chainDigest(prev, body) !== trailer) errors.push(`${label}: L1 chain mismatch — run store trailer stale/tampered`);
  const bodyLines = lines.slice(0, trailerIdx);
  bodyLines.forEach((ln, i) => {
    const lineno = i + 1;
    if (ln === "" || ln.startsWith("#")) return;
    const f = ln.split("\t");
    if (f.length !== 4) { errors.push(`${label}:${lineno}: ${f.length} fields (want 4: ts ⇥ key ⇥ verdict ⇥ asserts)`); return; }
    const [ts, key, verdict, asserts] = f;
    if (!isRealRunTs(ts)) errors.push(`${label}:${lineno}: bad ts "${ts}" (want a real YYYY-MM-DDThh:mm:ssZ)`);
    if (key.length === 0) errors.push(`${label}:${lineno}: empty key`);
    if (verdict !== "pass" && verdict !== "fail") errors.push(`${label}:${lineno}: bad verdict "${verdict}" (only {pass,fail})`);
    if (!ASSERTS_RE.test(asserts)) errors.push(`${label}:${lineno}: bad asserts "${asserts}" (decimal, no leading zeros)`);
  });
  return errors;
}

// ── the full lint over one ledger file ───────────────────────────────────────
export function lintFile(ledgerPath, env = process.env) {
  const errors = [];
  const prior = priorState(ledgerPath, env);
  if (!existsSync(ledgerPath)) {
    // a VANISHED baseline ledger (committed at HEAD, git mv/rm'd from the working tree). Its
    // working state is empty → every baseline PASS key is dropped → checkMonotone reds unless
    // ceremonied. This is how a rename/delete that erases a proven PASS set still gets caught
    // (review-1 FINDING 2 / M2), driven by the gate's LEDGER_LINT_BASELINE enumeration.
    if (prior.baseline.size === 0) return [`${ledgerPath}: no such ledger`];
    const empty = parseLedger("", basename(ledgerPath));
    errors.push(...checkMonotone(ledgerPath, empty, prior, env));
    return errors;
  }
  const text = readFileSync(ledgerPath, "utf8");
  const parsed = parseLedger(text, basename(ledgerPath));
  errors.push(...parsed.errors);
  errors.push(...checkChain(ledgerPath, parsed, prior.prevChain)); // L1
  errors.push(...checkMonotone(ledgerPath, parsed, prior, env));   // L2
  errors.push(...checkExpiry(ledgerPath, parsed, env));            // L3
  errors.push(...checkMarkersNotCommitted(ledgerPath));            // §9
  // the ledger's own run store is structurally linted alongside it (m3/MAJOR-C).
  const runPath = join(dirname(ledgerPath), "runs", basename(ledgerPath).replace(/\.tsv$/, ".runs.tsv"));
  errors.push(...lintRunStore(runPath, env));
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
