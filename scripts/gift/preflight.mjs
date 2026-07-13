#!/usr/bin/env node
// preflight — the gift pre-push review-gate (BAKE_A_BUN §9.4, invariants 4-9, 13, 14, 17, 18).
//
// A "candidate gift" is a prepared, not-yet-pushed fix for oven-sh/bun living at
//   conformance/gifts/<slug>/
//     candidate.json   — the metadata (see the SCHEMA block below)
//     pr-body.md        — the prepared PR body (bun's two headings + the provenance block)
//     tree/<testFile>   — the automated test, laid out at its real bun path under tree/
//
// preflight turns a candidate into a PR-ready one by MECHANIZING what can be mechanized here in
// this process, and EMITTING — never faking — the steps that need a built bun + the gift checkout.
//
//   MECHANIZED (run here, fail-loud):
//     • invariant 4/5 — a behavioral change ships an automated test, IN bun's format & folders
//       (test/js/{bun,node,web}/, test/cli/, test/bundler w/ itBundled, or the existing module
//       file); test/regression/issue/<N>.test.ts ONLY for a true regression with a REAL issue
//       number whose value matches the file name (never FAKE/placeholder).
//     • invariant 7 — non-flaky: the test source carries NO `setTimeout` (await the condition).
//     • invariant 17 — the standing open-PR cap: reads upstream-gifts.tsv's OPEN set (via the
//       W1.7 gifts tooling) and REFUSES a new `--want-ready` when N are already open.
//     • invariant 18 — the prepared PR body: bun's two headings present, the provenance block
//       present, and every HTML comment block ≤ 3 lines (their rule 13); a regression PR gets
//       exactly one comment — the issue URL.
//     • invariant 10 — a security=y candidate is NEVER marked PR-ready; it routes to
//       security@bun.com (templates/security-routing.md). --want-ready on a security finding fails.
//
//   [USER]-RUN (EMITTED as exact commands + a checklist; preflight RECORDS the user's result in
//   candidate.json.userSteps, it does NOT run or fake them — they need a built bun + the checkout):
//     • invariant 6 — the test FAILS under `USE_SYSTEM_BUN=1 bun test <file>` and PASSES under
//       `bun bd test <file>`. Recorded as useSystemBunFails (must be true) + bunBdTestPasses (true).
//     • invariant 14 — `bun run rust:check-all` (or zig:check-all) cross-platform type-check.
//     • invariant 13 — license/CLA: clean-room MIT, nothing derived from BSL sources; CLA/DCO
//       satisfied as GitHub presents it. A user-confirmed gate (licenseCla must be true).
//   A candidate whose [USER] steps are UNRECORDED (null) is PENDING — reported not-ready, with the
//   commands emitted; a [USER] step recorded FALSE is a hard rejection. preflight can never turn a
//   [USER] step green on its own — that is the anti-fake guarantee this gate exists to hold.
//
// The classification step (invariant 15) is `classify`, which stamps ours/theirs/spec-ambiguity
// into upstream-gifts.tsv VIA the W1.7 chain-append path (appendGiftRows) — it does NOT hand-write
// the chain.
//
// EXIT 0 = the candidate is PR-ready-eligible (all mechanized checks pass AND every [USER] step is
// recorded passing). Any nonzero exit = rejected/pending. Read-only git; never runs remote ops.
// npm-world tooling per CLAUDE.md R3; its RED driver is allowlisted → W2.9.
//
// ── candidate.json SCHEMA ──────────────────────────────────────────────────────────────────────
//   id               "G-<digits>"  — the finding id (matches upstream-gifts.tsv).
//   slug             "kebab-slug"  — the branch is `claude/gift-<slug>`.
//   security         "y" | "n"     — a security finding never becomes a public PR (invariant 10).
//   classification   ours|theirs|spec-ambiguity — a gift is `theirs`.
//   behavioralChange bool          — true ⇒ a test is REQUIRED (invariant 4).
//   isRegression     bool          — true ⇒ the test lives in test/regression/issue/<N>.test.ts.
//   issueNumber      "<digits>"|null — REAL GitHub issue number for a regression (invariant 5).
//   branch           "claude/gift-<slug>"
//   testFile         "test/js/.../x.test.ts" — the test's real bun path (mirrored under tree/).
//   prBody           "pr-body.md"
//   userSteps        { useSystemBunFails, bunBdTestPasses, rustCheckAll, licenseCla }
//                    each null (unrun) | true (user recorded pass) | false (user recorded fail).

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { appendGiftRows, currentGiftStates, CLASSES } from "../lints/gifts-lint.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const DEFAULT_CANDIDATES = join(ROOT, "conformance", "gifts");
const DEFAULT_GIFTS_LEDGER = join(ROOT, "conformance", "upstream-gifts.tsv");
const DEFAULT_CAP = 5; // the standing open-PR cap (invariant 17); overridable via --cap.

// bun's real test roots (vendor/bun/CLAUDE.md, "Creating Tests"): the module's existing file lives
// under one of these. test/regression/issue is the reserved regression folder (invariant 5).
const BUN_TEST_ROOTS = ["test/js/bun/", "test/js/node/", "test/js/web/", "test/cli/", "test/bundler/"];
const REGRESSION_DIR = "test/regression/issue/";

// ── arg parse ────────────────────────────────────────────────────────────────────────────────
function argv() {
  const a = process.argv.slice(2);
  const opt = (name, def = null) => { const i = a.indexOf(name); return i >= 0 && i + 1 < a.length ? a[i + 1] : def; };
  const flag = (name) => a.includes(name);
  return {
    checkDir: opt("--check-dir"),
    checkAll: flag("--check-all"),
    candidates: opt("--candidates", DEFAULT_CANDIDATES),
    giftsLedger: opt("--gifts-ledger", DEFAULT_GIFTS_LEDGER),
    cap: Number(opt("--cap", String(DEFAULT_CAP))),
    wantReady: flag("--want-ready"),
    classify: flag("classify") || flag("--classify"),
    positional: a.filter((x) => !x.startsWith("--") && x !== "classify"),
  };
}

// ── the emitted [USER] step block (invariants 6, 14, 13) — the anti-fake surface ──────────────
// This is ALWAYS printed (pass or fail). The user runs these against the built bun + the gift
// checkout, then records each result in candidate.json.userSteps. preflight NEVER runs them.
function emitUserSteps(meta, out) {
  const file = meta.testFile;
  out.push("");
  out.push("── [USER]-RUN STEPS (preflight EMITS these — it does NOT run or fake them) ──");
  out.push("Run each in the gift checkout with a built bun, then record the result in");
  out.push("candidate.json.userSteps (null → true/false). preflight can never green these itself.");
  out.push("");
  out.push(`  [USER] invariant 6a — the test must FAIL on the system bun (else it is not a valid gift):`);
  out.push(`         USE_SYSTEM_BUN=1 bun test ${file}`);
  out.push(`         record: userSteps.useSystemBunFails = true   (true ⇒ it failed, as required)`);
  out.push(`  [USER] invariant 6b — the test must PASS on the debug build:`);
  out.push(`         bun bd test ${file}`);
  out.push(`         record: userSteps.bunBdTestPasses = true`);
  out.push(`  [USER] invariant 14 — cross-platform type-check (#[cfg] on linux/macos/windows × x64/aarch64):`);
  out.push(`         bun run rust:check-all      (or: bun run zig:check-all for Zig-flavored fixes)`);
  out.push(`         record: userSteps.rustCheckAll = true`);
  out.push(`  [USER] invariant 13 — license/CLA: clean-room MIT, NOTHING derived from BSL`);
  out.push(`         logos-bun/logicaffeine sources; CLA/DCO satisfied as GitHub presents it.`);
  out.push(`         record: userSteps.licenseCla = true   (user-confirmed)`);
  out.push("");
}

// ── load one candidate ─────────────────────────────────────────────────────────────────────────
function loadCandidate(dir, errors) {
  const metaPath = join(dir, "candidate.json");
  if (!existsSync(metaPath)) { errors.push(`${dir}: no candidate.json`); return null; }
  let meta;
  try { meta = JSON.parse(readFileSync(metaPath, "utf8")); }
  catch (e) { errors.push(`${metaPath}: not valid JSON — ${e.message}`); return null; }
  return meta;
}

// ── invariant 4/5: a behavioral change ships an automated test in bun's format/folder ──────────
function checkTest(dir, meta, errors) {
  const file = meta.testFile;
  if (meta.behavioralChange && !file)
    { errors.push(`invariant 4 — behavioralChange=true but candidate.json declares no testFile (every behavioral change ships an automated test in the SAME PR)`); return; }
  if (!file) return; // a non-behavioral candidate (e.g. a pure doc/comment) needs no test file.

  // the test file must be laid out under tree/<testFile> so we can lint its source.
  const onDisk = join(dir, "tree", file);
  if (!existsSync(onDisk))
    errors.push(`invariant 4 — declared testFile "${file}" is missing on disk at tree/${file} (the test must ship in the PR)`);

  const isRegressionPath = file.startsWith(REGRESSION_DIR);
  const inBunRoot = BUN_TEST_ROOTS.some((r) => file.startsWith(r));
  if (!isRegressionPath && !inBunRoot)
    errors.push(`invariant 4 — test "${file}" is not in bun's format/folders (want one of ${BUN_TEST_ROOTS.join(", ")} or ${REGRESSION_DIR}<N>.test.ts, in the module's EXISTING file — not a new ad-hoc path)`);
  if (!/\.test\.tsx?$/.test(file))
    errors.push(`invariant 4 — test "${file}" must end in .test.ts / .test.tsx (bun rule 5)`);

  // invariant 5: test/regression/issue/<N>.test.ts is RESERVED for true regressions with a REAL N.
  if (isRegressionPath) {
    if (!meta.isRegression)
      errors.push(`invariant 5 — "${file}" is in ${REGRESSION_DIR} but isRegression=false; the regression folder is reserved for true regressions (worked, then broke). A never-worked differential find goes in the module's existing file.`);
    const fname = basename(file).replace(/\.test\.tsx?$/, "");
    if (!/^[0-9]+$/.test(fname))
      errors.push(`invariant 5 — regression file name "${basename(file)}" is not <REAL-N>.test.ts (a placeholder like FAKE is forbidden; the issue number must be a REAL GitHub issue number)`);
    if (meta.issueNumber == null || String(meta.issueNumber) === "" || String(meta.issueNumber).toUpperCase() === "FAKE" || !/^[0-9]+$/.test(String(meta.issueNumber)))
      errors.push(`invariant 5 — a regression requires a REAL GitHub issue number in candidate.json.issueNumber (got ${JSON.stringify(meta.issueNumber)}); never a placeholder like FAKE.`);
    else if (/^[0-9]+$/.test(fname) && String(meta.issueNumber) !== fname)
      errors.push(`invariant 5 — regression file name "${fname}" disagrees with declared issueNumber "${meta.issueNumber}" (test/regression/issue/<N>.test.ts must be named for its issue number)`);
  } else if (meta.isRegression) {
    errors.push(`invariant 5 — isRegression=true but "${file}" is not under ${REGRESSION_DIR} (a true regression's test belongs in test/regression/issue/<N>.test.ts)`);
  }
}

// ── invariant 7: non-flaky — the test source must not use setTimeout ───────────────────────────
function checkFlaky(dir, meta, errors) {
  if (!meta.testFile) return;
  const onDisk = join(dir, "tree", meta.testFile);
  if (!existsSync(onDisk)) return; // the missing-test error is already raised by checkTest.
  const src = readFileSync(onDisk, "utf8");
  if (/\bsetTimeout\s*\(/.test(src))
    errors.push(`invariant 7 — flaky test: "${meta.testFile}" uses setTimeout (bun rejects flaky tests outright; await the condition, do not sleep on a timer)`);
  // invariant 7 also bans "no panic / no uncaught exception" tests — worthless as gifts.
  if (/no\s+(panic|uncaught|crash)/i.test(src) && /(expect|assert)/i.test(src) && /output|stderr|stdout/i.test(src))
    errors.push(`invariant 7 — a test that only asserts "no panic / no uncaught exception" never fails in CI and is worthless as a gift; assert the concrete corrected behavior instead`);
}

// ── invariant 18: PR body — headings, provenance, comment length, regression=one-comment ───────
function checkPrBody(dir, meta, errors) {
  const p = join(dir, meta.prBody || "pr-body.md");
  if (!existsSync(p)) { errors.push(`invariant 12 — no prepared PR body at ${basename(p)} (a gift follows bun's PR template + the provenance block)`); return; }
  const body = readFileSync(p, "utf8");
  if (!/^###\s*What does this PR do\?/m.test(body))
    errors.push(`invariant 12 — PR body missing bun's heading "### What does this PR do?"`);
  if (!/^###\s*How did you verify your code works\?/m.test(body))
    errors.push(`invariant 12 — PR body missing bun's heading "### How did you verify your code works?"`);
  if (!/Provenance & authorship/i.test(body) || !/differential fuzz/i.test(body) || !/Claude-authored/i.test(body))
    errors.push(`invariant 12/13 — PR body missing the mandatory provenance & AI-authorship disclosure (how it was found: differential fuzzing; authorship: Claude-authored, human-reviewed; clean-room license)`);

  // invariant 18 — every HTML comment block is ≤ 3 lines (bun rule 13: comments ≤ 3 lines).
  const commentRe = /<!--([\s\S]*?)-->/g;
  let m;
  while ((m = commentRe.exec(body)) !== null) {
    const inner = m[1].replace(/^\n/, "").replace(/\n$/, "");
    const lineCount = inner.length === 0 ? 0 : inner.split("\n").length;
    if (lineCount > 3)
      errors.push(`invariant 18 — a PR-body comment block is ${lineCount} lines (> 3); bun rule 13 caps comments at 3 lines`);
  }

  // invariant 18 — a regression test gets EXACTLY one comment: the issue URL.
  if (meta.isRegression) {
    const urls = body.match(/https?:\/\/github\.com\/[^\s)]+\/issues\/[0-9]+/g) || [];
    if (urls.length !== 1)
      errors.push(`invariant 18 — a regression PR gets exactly ONE comment: the issue URL (found ${urls.length} issue URL(s) in the PR body)`);
  }
}

// ── invariant 17: the standing open-PR cap ─────────────────────────────────────────────────────
function checkCap(meta, opt, errors) {
  if (!opt.wantReady) return; // the cap only bites when we're asking to MARK this candidate ready.
  const led = currentGiftStates(opt.giftsLedger);
  if (led.errors.length)
    errors.push(`invariant 17 — cannot read the gift ledger to enforce the cap: ${led.errors.join("; ")}`);
  const already = led.states.has(meta.id) ? 0 : 1; // a NEW id adds one to the open set.
  if (led.openCount + already > opt.cap)
    errors.push(`invariant 17 — the standing open-PR cap of ${opt.cap} is already met (${led.openCount} open); refusing to mark "${meta.id}" ready. Quality over volume: land or close an open gift first.`);
}

// ── invariant 10: a security finding is NEVER a public PR ──────────────────────────────────────
function checkSecurityEmbargo(meta, opt, errors) {
  if (meta.security === "y" && opt.wantReady)
    errors.push(`invariant 10 — "${meta.id}" is security=y; a security finding NEVER opens a public PR first. Route it to security@bun.com (templates/security-routing.md); it stays embargoed until coordinated disclosure. --want-ready refused.`);
}

// ── the [USER] step verdict — the anti-fake gate ───────────────────────────────────────────────
// Returns { pending: [...], failed: [...] }. A null step is PENDING (unrun); a false step is a
// FAIL. preflight passes ONLY when every step is recorded true — it never fills one in itself.
function userStepVerdict(meta) {
  const s = meta.userSteps || {};
  const want = {
    useSystemBunFails: "invariant 6a (USE_SYSTEM_BUN=1 must FAIL)",
    bunBdTestPasses: "invariant 6b (bun bd test must PASS)",
    rustCheckAll: "invariant 14 (cross-platform check must pass)",
    licenseCla: "invariant 13 (license/CLA confirmed)",
  };
  const pending = [], failed = [];
  for (const [k, why] of Object.entries(want)) {
    const v = s[k];
    if (v === null || v === undefined) pending.push(`${k} — ${why}`);
    else if (v !== true) failed.push(`${k}=${JSON.stringify(v)} — ${why}`);
  }
  return { pending, failed };
}

// ── check ONE candidate ────────────────────────────────────────────────────────────────────────
function checkOne(dir, opt) {
  const out = [];
  const errors = [];
  out.push(`preflight: candidate ${dir}`);
  const meta = loadCandidate(dir, errors);
  if (!meta) return { ok: false, out, errors };

  // mechanized gates.
  checkTest(dir, meta, errors);
  checkFlaky(dir, meta, errors);
  checkPrBody(dir, meta, errors);
  checkSecurityEmbargo(meta, opt, errors);
  checkCap(meta, opt, errors);

  // ALWAYS emit the [USER] steps (the anti-fake surface) — pass or fail.
  emitUserSteps(meta, out);

  // the [USER] step verdict: pending (unrun) blocks readiness; failed is a hard reject.
  const { pending, failed } = userStepVerdict(meta);
  for (const f of failed) errors.push(`[USER] step FAILED: ${f}`);
  let pendingBlock = false;
  if (pending.length) {
    pendingBlock = true;
    out.push(`  PENDING [USER] step(s) — NOT auto-passed (run the emitted commands, then record the result):`);
    for (const p of pending) out.push(`    • ${p}`);
  }

  const ok = errors.length === 0 && !pendingBlock;
  return { ok, out, errors, pending: pendingBlock };
}

// ── check ALL candidates under a root (the gate path; empty ⇒ trivial pass) ───────────────────
function checkAll(opt) {
  const root = opt.candidates;
  const out = [];
  if (!existsSync(root)) { out.push(`preflight --check-all: no candidates root at ${root} — trivially green (no gifts yet, GIFT.4 open)`); return { ok: true, out }; }
  const dirs = readdirSync(root)
    .map((n) => join(root, n))
    .filter((p) => { try { return statSync(p).isDirectory() && existsSync(join(p, "candidate.json")); } catch { return false; } });
  if (dirs.length === 0) { out.push(`preflight --check-all: no candidate gifts under ${root} — trivially green (empty guard)`); return { ok: true, out }; }
  let ok = true;
  for (const d of dirs) {
    const r = checkOne(d, opt);
    out.push(...r.out);
    for (const e of r.errors) out.push(`  REJECT ${basename(d)}: ${e}`);
    if (!r.ok) ok = false;
  }
  return { ok, out };
}

// ── classify (invariant 15) — stamp ours/theirs/spec-ambiguity VIA the W1.7 chain-append path ──
// Usage: preflight.mjs classify <G-id> <ours|theirs|spec-ambiguity> [--security y|n]
//        [--note "..."] [--gifts-ledger <path>]
// This appends the `found` row (if the finding is new) and the `classified` row through
// appendGiftRows — the W1.7 tool's chain-append writer. The chain is NOT hand-written here.
function classify(opt) {
  const [id, cls] = opt.positional;
  const out = [];
  if (!id || !/^G-[0-9]+$/.test(id)) return { ok: false, out: [`classify: first arg must be a finding id G-<digits> (got ${JSON.stringify(id)})`] };
  if (!CLASSES.has(cls)) return { ok: false, out: [`classify: classification must be one of ours|theirs|spec-ambiguity (got ${JSON.stringify(cls)})`] };
  const a = process.argv.slice(2);
  const sec = (() => { const i = a.indexOf("--security"); return i >= 0 ? a[i + 1] : "n"; })();
  const note = (() => { const i = a.indexOf("--note"); return i >= 0 ? a[i + 1] : ""; })();
  if (sec !== "y" && sec !== "n") return { ok: false, out: [`classify: --security must be y|n (got ${JSON.stringify(sec)})`] };

  // if the finding is not yet in the ledger, it must be born at `found` first (the state machine
  // begins there). We append found→classified as a pair so a brand-new finding is fully seeded.
  const led = currentGiftStates(opt.giftsLedger);
  const rows = [];
  if (!led.states.has(id)) rows.push({ id, state: "found", cls: "-", sec, artifacts: "-", note: note || "differential mismatch (classify)" });
  else if (led.states.get(id) !== "found") return { ok: false, out: [`classify: "${id}" is already past \`found\` (state ${led.states.get(id)}); classification happens once, right after found`] };
  rows.push({ id, state: "classified", cls, sec, artifacts: "-", note: note || `triaged as ${cls}` });

  const res = appendGiftRows(opt.giftsLedger, rows);
  if (!res.ok) return { ok: false, out: res.errors.map((e) => `classify (via gifts chain-append): ${e}`) };
  out.push(`classify: ${id} classified "${cls}" (security=${sec}) — appended via the W1.7 gifts chain-append path to ${basename(opt.giftsLedger)}`);
  return { ok: true, out };
}

// ── main ────────────────────────────────────────────────────────────────────────────────────
function main() {
  const opt = argv();
  let result;
  if (opt.classify) result = classify(opt);
  else if (opt.checkAll) result = checkAll(opt);
  else if (opt.checkDir) result = checkOne(opt.checkDir, opt);
  else {
    console.error("usage:\n  preflight.mjs --check-dir <candidateDir> [--want-ready] [--cap N] [--gifts-ledger P]\n  preflight.mjs --check-all [--candidates <root>]\n  preflight.mjs classify <G-id> <ours|theirs|spec-ambiguity> [--security y|n] [--note ..]");
    process.exit(2);
  }
  for (const line of result.out) console.log(line);
  if (result.errors) for (const e of result.errors) console.error("PREFLIGHT REJECT: " + e);
  if (result.ok) { console.log("preflight: OK"); process.exit(0); }
  console.error(`preflight: ${result.pending ? "PENDING (run + record the [USER] steps above)" : "REJECTED"}`);
  process.exit(1);
}
main();
