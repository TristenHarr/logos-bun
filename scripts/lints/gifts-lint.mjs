#!/usr/bin/env node
// gifts-lint — validates conformance/upstream-gifts.tsv, the gift finding state machine
// (BAKE_A_BUN §9.4, invariants 10/11/12/13/15). The human covenant + row grammar live in the
// sibling conformance/upstream-gifts.md; the machine-readable rows live in the .tsv this lints.
// One row per finding-state; a finding's
// rows form its append-only, hash-chained history (SCHEMA.md §4 discipline, REUSED verbatim
// — this file does NOT reimplement sha256 chaining, it imports it from ledger-lint.mjs).
//
// What it rejects:
//   • an illegal state transition (SCHEMA-style transition table below) — e.g. found→filed
//     skipping classified;
//   • a row past `found` with no classification (ours/theirs/spec-ambiguity) — invariant 15;
//   • invariant 10: a security=y finding that carries ANY public artifact link (a PR URL or
//     issue URL) — security findings route to security@bun.com, never public first;
//   • a broken/stale #CHAIN trailer (tamper) — via the shared chain recompute.
//
// npm-world tooling per CLAUDE.md R3; its RED driver is allowlisted → W2.9.
import { readFileSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// REUSE the W1.1 chain core — the SINGLE home of sha256 chaining + prior-state resolution.
import { GENESIS, TRAILER_RE, chainDigest, priorState } from "./ledger-lint.mjs";

// ── the finding state machine (§9.4 invariant 15) ────────────────────────────
// found → classified → {embargoed | ready} → filed → {in-review | changes-requested}
//   → {merged | declined | duplicate | superseded-upstream | stale} → re-baselined
export const STATES = new Set([
  "found", "classified", "embargoed", "ready", "filed",
  "in-review", "changes-requested",
  "merged", "declined", "duplicate", "superseded-upstream", "stale",
  "re-baselined",
]);

// legal successors of each state. A finding's row sequence must walk only these edges.
// The terminal outcomes ({merged,declined,duplicate,superseded-upstream,stale}) all lead to
// re-baselined, which is absorbing (a finding, once re-baselined, is closed).
export const TRANSITIONS = new Map([
  ["found", new Set(["classified"])],
  ["classified", new Set(["embargoed", "ready"])],
  // an embargoed (security) finding, once coordinated & cleared, becomes ready to file.
  ["embargoed", new Set(["ready", "filed"])],
  ["ready", new Set(["filed"])],
  ["filed", new Set(["in-review", "changes-requested"])],
  // review churns: reviewers request changes, we revise, it re-enters review.
  ["in-review", new Set(["changes-requested", "merged", "declined", "duplicate", "superseded-upstream", "stale"])],
  ["changes-requested", new Set(["in-review", "merged", "declined", "duplicate", "superseded-upstream", "stale"])],
  ["merged", new Set(["re-baselined"])],
  ["declined", new Set(["re-baselined"])],
  ["duplicate", new Set(["re-baselined"])],
  ["superseded-upstream", new Set(["re-baselined"])],
  ["stale", new Set(["re-baselined"])],
  ["re-baselined", new Set([])], // absorbing — closed
]);

// classification must be one of these (invariant 15) for any state past `found`.
export const CLASSES = new Set(["ours", "theirs", "spec-ambiguity"]);

// ── the row grammar (6 TAB-separated fields, mirroring SCHEMA §2.1 splitting) ──
//   ID ⇥ STATE ⇥ CLASSIFICATION ⇥ SECURITY ⇥ ARTIFACTS ⇥ NOTE
// ID:             finding id, `G-` then digits (stable per finding).
// STATE:          one STATES token.
// CLASSIFICATION: ours|theirs|spec-ambiguity — or `-` ONLY while STATE is `found`.
// SECURITY:       y|n (must NOT change across a finding's history).
// ARTIFACTS:      ';'-separated links (PR/issue/security-thread refs), or `-` when none.
// NOTE:           free text; may be empty (but its leading TAB is still required, §2.1).
const ID_RE = /^G-[0-9]+$/;
const SECURITY_RE = /^[yn]$/;
// public artifact = a GitHub PR or issue URL. Both oven-sh/bun and the fork count as public.
// (An embargoed security thread is referenced as `security@bun.com` or `SEC-<n>`, never a URL.)
const PUBLIC_LINK_RE =
  /https?:\/\/github\.com\/[^/\s;]+\/[^/\s;]+\/(pull|issues)\/[0-9]+|(?:^|[;\s])#[0-9]+(?:$|[;\s])/;

// ── parse: split the gift ledger into {rows, trailer, body, errors} ───────────
// Same three line-kinds as SCHEMA §1: comment/blank, row, and the single last #CHAIN trailer.
// Markdown prose lines are comments IFF they don't contain a TAB (a row is TAB-delimited);
// to stay unambiguous, a data row MUST have exactly 5 TABs and MUST NOT start with '#'.
export function parseGifts(text, label = "upstream-gifts.tsv") {
  const errors = [];
  if (text.includes("\r")) errors.push(`${label}: contains CR — LF-only files only`);
  if (text.length > 0 && !text.endsWith("\n")) errors.push(`${label}: file must end in a newline`);

  const lines = text.length ? text.split("\n") : [];
  if (lines.length && lines[lines.length - 1] === "") lines.pop();

  let trailer = null, trailerIdx = -1;
  if (lines.length) {
    const m = lines[lines.length - 1].match(TRAILER_RE);
    if (m) { trailer = m[1]; trailerIdx = lines.length - 1; }
  }
  lines.forEach((ln, i) => {
    if (i !== trailerIdx && TRAILER_RE.test(ln))
      errors.push(`${label}:${i + 1}: stray #CHAIN-shaped line (only the last line may be the trailer)`);
  });
  if (trailer === null) errors.push(`${label}: missing #CHAIN trailer`);

  let body = "";
  if (trailerIdx >= 0) {
    const trailerLine = "#CHAIN " + trailer + "\n";
    if (!text.endsWith(trailerLine))
      errors.push(`${label}: trailer line is not byte-exact ("#CHAIN " + 64hex + "\\n")`);
    body = text.slice(0, text.length - trailerLine.length);
  }

  const rows = [];
  const bodyLines = trailerIdx >= 0 ? lines.slice(0, trailerIdx) : lines;
  bodyLines.forEach((ln, i) => {
    const lineno = i + 1;
    if (ln === "" || ln.startsWith("#")) return; // blank or comment/prose
    if (!ln.includes("\t")) return;              // markdown prose without TABs is a comment
    const fields = ln.split("\t");
    if (fields.length !== 6) {
      errors.push(`${label}:${lineno}: ${fields.length} fields (want 6 TAB-separated: ID⇥STATE⇥CLASS⇥SEC⇥ARTIFACTS⇥NOTE)`);
      return;
    }
    const [id, state, cls, sec, artifacts, note] = fields;
    if (!ID_RE.test(id)) errors.push(`${label}:${lineno}: bad finding id "${id}" (want G-<digits>)`);
    if (!STATES.has(state)) errors.push(`${label}:${lineno}: unknown state "${state}"`);
    if (!SECURITY_RE.test(sec)) errors.push(`${label}:${lineno}: security must be y|n, got "${sec}"`);
    // classification: required (ours/theirs/spec-ambiguity) for every state past `found`.
    if (state === "found") {
      if (cls !== "-" && !CLASSES.has(cls))
        errors.push(`${label}:${lineno}: classification "${cls}" invalid (want -|ours|theirs|spec-ambiguity)`);
    } else if (!CLASSES.has(cls)) {
      errors.push(`${label}:${lineno}: state "${state}" requires a classification (ours|theirs|spec-ambiguity), got "${cls}"`);
    }
    rows.push({ id, state, cls, sec, artifacts, note, lineno, raw: ln });
  });

  return { ok: errors.length === 0, errors, rows, trailer, body };
}

// ── invariant 10: a security=y finding may carry NO public artifact link, ever ─
// This is checked per-ROW (not just per-finding-current-state) so a security finding cannot
// leak through ANY historical row — a determined multi-step edit that briefly parks a URL on
// an intermediate `changes-requested` row is still caught, because every row is scanned.
// BOTH the artifact-link AND the free-text note are scanned: the note is the only other field
// wide enough to smuggle a URL, and the covenant is "NO public link on a security finding, in
// ANY field" — so the note is not an escape hatch (a reviewer-attack-surface hardening).
export function checkSecurityRouting(label, rows) {
  const errors = [];
  for (const r of rows) {
    if (r.sec !== "y") continue;
    if (r.artifacts !== "-" && PUBLIC_LINK_RE.test(r.artifacts))
      errors.push(`${label}:${r.lineno}: invariant 10 — security=y finding "${r.id}" carries a PUBLIC artifact link "${r.artifacts}" (security findings route to security@bun.com, NEVER a public PR/issue; use a SEC-<n>/security@bun.com ref)`);
    if (PUBLIC_LINK_RE.test(r.note))
      errors.push(`${label}:${r.lineno}: invariant 10 — security=y finding "${r.id}" hides a PUBLIC link in its note "${r.note}" (a security finding carries NO public PR/issue link in ANY field; the note is not an escape hatch — route to security@bun.com)`);
  }
  return errors;
}

// ── security flag stability: a finding's y/n must not flip across its history ──
// (a finding does not silently become non-security to shed the routing constraint.)
export function checkSecurityStable(label, rows) {
  const errors = [];
  const byId = new Map();
  for (const r of rows) {
    if (!byId.has(r.id)) byId.set(r.id, r.sec);
    else if (byId.get(r.id) !== r.sec)
      errors.push(`${label}:${r.lineno}: finding "${r.id}" security flag flipped ${byId.get(r.id)}→${r.sec} (must be stable across the finding's history)`);
  }
  return errors;
}

// ── the transition law: each finding's ordered rows walk only legal edges ─────
// File order is chronological (append-only, chained). The FIRST row of a finding must be
// `found` (a finding is born there); every subsequent row's state must be a legal successor
// of the immediately-prior state.
export function checkTransitions(label, rows) {
  const errors = [];
  const byId = new Map();
  for (const r of rows) {
    if (!byId.has(r.id)) byId.set(r.id, []);
    byId.get(r.id).push(r);
  }
  for (const [id, seq] of byId) {
    if (seq[0].state !== "found")
      errors.push(`${label}:${seq[0].lineno}: finding "${id}" does not begin at "found" (first state "${seq[0].state}")`);
    for (let i = 1; i < seq.length; i++) {
      const from = seq[i - 1].state, to = seq[i].state;
      const legal = TRANSITIONS.get(from);
      if (!legal || !legal.has(to))
        errors.push(`${label}:${seq[i].lineno}: finding "${id}" illegal transition ${from}→${to} (legal from "${from}": ${legal ? [...legal].join(", ") || "(none — terminal)" : "(unknown)"})`);
    }
  }
  return errors;
}

// ── L1-style chain validity, REUSED from the shared core ──────────────────────
export function checkGiftChain(label, parsed, prevChain) {
  const errors = [];
  if (parsed.trailer === null) return [`${label}: chain — no trailer to verify`];
  const want = chainDigest(prevChain, parsed.body);
  if (parsed.trailer !== want)
    errors.push(`${label}: chain mismatch — trailer ${parsed.trailer.slice(0, 12)}… != recomputed ${want.slice(0, 12)}… (stale/hand-edited body)`);
  return errors;
}

// ── the full lint over one gift ledger ────────────────────────────────────────
export function lintGifts(path) {
  const label = basename(path);
  if (!existsSync(path)) return [`${path}: no such gift ledger`];
  const text = readFileSync(path, "utf8");
  const parsed = parseGifts(text, label);
  const errors = [...parsed.errors];
  // prior state (snapshot > git HEAD > GENESIS) via the shared resolver — same seam the
  // fixtures use (<path>.head) so gifts fixtures are hermetic exactly like ledger fixtures.
  const { prevChain } = priorState(path);
  errors.push(...checkGiftChain(label, parsed, prevChain ?? GENESIS));
  errors.push(...checkTransitions(label, parsed.rows));
  errors.push(...checkSecurityRouting(label, parsed.rows));
  errors.push(...checkSecurityStable(label, parsed.rows));
  return errors;
}

// ── the OPEN set (invariant 17 cap input) ─────────────────────────────────────
// The "open" gifts are those with an in-flight PR upstream: ready/filed/in-review/changes-
// requested (embargoed security findings are NOT public PRs, so they don't count against the
// public-PR cap). Returns Map<id, currentState> for all findings, and the derived open count, so
// preflight's rate-limit refusal reads the SAME parse the lint validates (no divergent grammar).
export const OPEN_STATES = new Set(["ready", "filed", "in-review", "changes-requested"]);
export function currentGiftStates(path) {
  const label = basename(path);
  if (!existsSync(path)) return { states: new Map(), openCount: 0, errors: [] };
  const parsed = parseGifts(readFileSync(path, "utf8"), label);
  const states = new Map();
  for (const r of parsed.rows) states.set(r.id, r.state); // latest row per id wins (append order)
  let openCount = 0;
  for (const s of states.values()) if (OPEN_STATES.has(s)) openCount++;
  return { states, openCount, errors: parsed.errors };
}

// ── the chain-APPEND path (invariant 15 classify + state advance) ─────────────
// The SINGLE writer of new gift rows. A caller (e.g. scripts/gift/preflight.mjs's `classify`)
// hands one or more rows to append; this parses the current ledger, appends them to the body,
// re-lints the whole result (transitions/classification/security), and — only if that passes —
// reseals via the SHARED chainDigest(prevChain, newBody). The chain is NEVER hand-written by a
// caller: they call THIS, so a classify that would produce an illegal transition or a security
// leak is refused BEFORE it touches the file (leave-things-better: the write can't create an
// invalid ledger). Each `row` is {id, state, cls, sec, artifacts, note}; fields default sanely.
// Returns { ok, errors } and, on ok, has written the resealed ledger to `path`.
export function appendGiftRows(path, rows) {
  const label = basename(path);
  const errors = [];
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, errors: [`${label}: appendGiftRows requires at least one row`] };
  // seed an empty-but-sealed ledger if the file is absent, so the first classify can bootstrap.
  let text = existsSync(path) ? readFileSync(path, "utf8") : "#CHAIN " + chainDigest(GENESIS, "") + "\n";
  const parsed = parseGifts(text, label);
  if (!parsed.ok) return { ok: false, errors: parsed.errors.map((e) => `refusing to append onto an already-invalid ledger — ${e}`) };

  const line = (r) => {
    const id = r.id, state = r.state;
    const cls = r.cls ?? (state === "found" ? "-" : "");
    const sec = r.sec ?? "n";
    const artifacts = r.artifacts ?? "-";
    const note = r.note ?? "";
    if (/[\t\n\r]/.test(id + state + cls + sec + artifacts + note))
      throw new Error(`${label}: a gift row field contains a TAB/newline (would corrupt the TSV): ${JSON.stringify(r)}`);
    return [id, state, cls, sec, artifacts, note].join("\t");
  };

  let newBody;
  try {
    const appended = rows.map(line).join("\n") + "\n";
    newBody = parsed.body + appended;
  } catch (e) {
    return { ok: false, errors: [String(e.message || e)] };
  }

  // re-lint the PROSPECTIVE ledger (body + a fresh trailer) as a whole — this is the gate that
  // makes append refuse an illegal transition / missing classification / security-leak BEFORE write.
  const prevChain = priorState(path).prevChain ?? GENESIS;
  const prospective = newBody + "#CHAIN " + chainDigest(prevChain, newBody) + "\n";
  const reparsed = parseGifts(prospective, label);
  const lintErrors = [
    ...reparsed.errors,
    ...checkTransitions(label, reparsed.rows),
    ...checkSecurityRouting(label, reparsed.rows),
    ...checkSecurityStable(label, reparsed.rows),
  ];
  if (lintErrors.length) return { ok: false, errors: lintErrors };

  writeFileSync(path, prospective);
  return { ok: true, errors: [] };
}

// ── CLI ───────────────────────────────────────────────────────────────────────
function isMain() {
  return process.argv[1] && process.argv[1].endsWith("gifts-lint.mjs");
}
if (isMain()) {
  const args = process.argv.slice(2);
  let targets = args.filter((a) => !a.startsWith("--"));
  if (targets.length === 0) {
    // default: the canonical machine-readable ledger (the sibling .tsv; the .md is pure
    // human covenant prose, so editing it never disturbs the chain). See upstream-gifts.md
    // §"Where the rows live" for the split. Absent/empty ledger = trivial pass.
    const here = dirname(fileURLToPath(import.meta.url));
    const cand = join(here, "..", "..", "conformance", "upstream-gifts.tsv");
    if (existsSync(cand)) targets = [cand];
    else { console.log("gifts-lint ok: no upstream-gifts.tsv yet"); process.exit(0); }
  }
  let fails = 0;
  for (const t of targets) {
    const errs = lintGifts(t);
    if (errs.length) { for (const e of errs) console.error("GIFTS-LINT FAIL: " + e); fails += errs.length; }
    else console.log("gifts-lint ok: " + basename(t));
  }
  process.exit(fails ? 1 : 0);
}
