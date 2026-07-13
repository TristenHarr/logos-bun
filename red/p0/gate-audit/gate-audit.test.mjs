// W1.6 — THE GATE-AUDIT META-LOCK. The most important check in the campaign: it proves the gate
// CATCHES every planted violation. Wave 1 proved how many real bugs hide behind green-in-isolation
// — so a gate that silently STOPS catching a planted violation is itself the regression this lock
// exists to freeze on. It re-runs at EVERY wave exit forever (it is part of the --full/--wave RED
// battery), and its VIOLATIONS_CAUGHT floor (below) only ever RISES.
//
// DESIGN. Each plant is ONE deliberately-bad fixture, driven through a REAL enforcement path, with
// the assertion that the gate REDS (or the tool REFUSES). Three faithful drive modes, all hermetic:
//   (S) SKELETON  — for gate-structural checks that read fixed repo files with no seam (L15 anchors,
//       L6 pins, L7 vendor, L9 gate-manifest, L16 allowlist): assemble a MINIMAL repo containing a
//       real copy of scripts/gate.sh + the scripts it invokes, seeded to a known-GREEN baseline,
//       then plant ONE violation and assert GREEN→RED with the right tag. A positive control (the
//       un-mutated skeleton) MUST be GREEN so a crash can never masquerade as the RED we require.
//   (G) GATE-SEAM — for the ledger family (chain-break, PASS-shrink, expired-quarantine, committed
//       markers, .merge-freeze, and the B1 off-tag lint CRASH): run the REAL gate.sh pointed at a
//       temp ledger tree via the LEDGER_GATE_DIR seam (exactly as the b1/freeze fixtures do) and
//       assert the whole gate reds.
//   (T) TOOL      — for the lints/committer the gate wraps (L8 ops-lint, L4 lint-lanes, L5 assert-
//       parity, L17 gifts, commit.mjs exit 3/4/5): invoke the EXACT tool the gate function invokes
//       against a planted temp fixture and assert the SAME nonzero exit the gate keys on. (The B1
//       plant additionally proves the gate function reds on that nonzero exit, closing the wrap.)
//
// HERMETIC: every mutation happens inside a throwaway temp dir — NEVER the live logos-bun tree.
// Read-only git only against the real repo. Temp dirs are removed on the way out.
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, existsSync, chmodSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const GATE = join(ROOT, "scripts", "gate.sh");
const LINTS = join(ROOT, "scripts", "lints");

// ── VIOLATIONS_CAUGHT floor (only rises; futamura_ratchet.rs pattern) ──────────────
// Every plant below asserts a violation is CAUGHT and increments `caught`. The floor is the
// count of DISTINCT enforcement rules this audit proves the gate catches. Raising a plant raises
// the floor in the same commit; a plant that stops catching drops `caught` below the floor → RED.
const VIOLATIONS_CAUGHT_FLOOR = 21;

const fails = [];
let caught = 0;
const record = (ok, label) => {
  if (ok) { caught++; console.log(`  CAUGHT ${label}`); }
  else fails.push(`UNCAUGHT (a gate gap!) — ${label}`);
};

// ── shared helpers ────────────────────────────────────────────────────────────────
const GENESIS = "0".repeat(64);
function chainDigest(prev, body) {
  return createHash("sha256")
    .update(Buffer.concat([Buffer.from(prev, "utf8"), Buffer.from(body, "utf8")]))
    .digest("hex");
}
const sealLedger = (body) => body + "#CHAIN " + chainDigest(GENESIS, body) + "\n";

// run any command → {code, out}; never throws (a nonzero exit is the expected result).
function run(cmd, args, opts = {}) {
  try {
    const out = execFileSync(cmd, args, { encoding: "utf8", stdio: "pipe", ...opts });
    return { code: 0, out };
  } catch (e) {
    return { code: typeof e.status === "number" ? e.status : 1, out: (e.stdout || "") + (e.stderr || "") };
  }
}

// (G) run the REAL gate.sh with the ledger checks pointed at `dir` (LEDGER_GATE_DIR seam).
function runGateOnLedger(dir) {
  return run("bash", [GATE, "--quick"], {
    env: { ...process.env, LEDGER_GATE_DIR: dir, LEDGER_TODAY: "2026-07-13" },
  });
}
const cleanup = [];
const tmp = (prefix) => { const d = mkdtempSync(join(tmpdir(), prefix)); cleanup.push(d); return d; };

// ════════════════════════════════════════════════════════════════════════════════════
// (S) SKELETON — a minimal, self-contained repo whose gate.sh is the REAL one. Seeded GREEN.
// ════════════════════════════════════════════════════════════════════════════════════
// A tiny git repo standing in for a vendor submodule at a KNOWN head (we write the pins to match
// whatever head it lands on, so L6's pin==submodule check is satisfied in the skeleton).
function tinyRepo(dir) {
  mkdirSync(dir, { recursive: true });
  const g = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8", stdio: "pipe" });
  g("init", "-q");
  g("config", "user.email", "fixture@logos-bun.test");
  g("config", "user.name", "fixture");
  g("config", "commit.gpgsign", "false");
  writeFileSync(join(dir, "PIN"), "pinned\n");
  g("add", "PIN"); g("commit", "-q", "-m", "pin");
  return g("rev-parse", "HEAD").trim();
}

// Build a known-GREEN skeleton repo. Returns { dir, gate }.
function skeleton() {
  const dir = tmp("gaudit-skel-");
  const R = (...p) => join(dir, ...p);
  mkdirSync(R("scripts", "lints"), { recursive: true });
  mkdirSync(R("scripts", "gift"), { recursive: true });
  mkdirSync(R("conformance", "ledger"), { recursive: true });
  mkdirSync(R("bench"), { recursive: true });
  mkdirSync(R("red", "p0"), { recursive: true });
  mkdirSync(R("vendor-artifacts", "oracle-bun"), { recursive: true });
  mkdirSync(R("work", "worktrees"), { recursive: true });

  // Real gate.sh + every script it invokes (so the WHOLE gate runs, not a stub).
  cpSync(GATE, R("scripts", "gate.sh"));
  chmodSync(R("scripts", "gate.sh"), 0o755);
  cpSync(join(ROOT, "scripts", "gate-manifest.json"), R("scripts", "gate-manifest.json"));
  for (const f of ["ledger-lint.mjs", "assert-parity-lint.mjs", "gifts-lint.mjs", "workflow-ops-lint.mjs"]) {
    cpSync(join(LINTS, f), R("scripts", "lints", f));
  }
  // L18: the gift pre-push review-gate (preflight.mjs imports the copied gifts-lint.mjs).
  cpSync(join(ROOT, "scripts", "gift", "preflight.mjs"), R("scripts", "gift", "preflight.mjs"));
  cpSync(join(ROOT, "conformance", "lint-lanes.mjs"), R("conformance", "lint-lanes.mjs"));
  cpSync(join(ROOT, "conformance", "fuzz-driver.mjs"), R("conformance", "fuzz-driver.mjs"));
  cpSync(join(ROOT, "bench", "verify.mjs"), R("bench", "verify.mjs"));
  cpSync(join(ROOT, "bench", "lib.mjs"), R("bench", "lib.mjs"));
  // L14: the mutation-score floor read (empty-guards to a trivial pass with no score file).
  cpSync(join(ROOT, "scripts", "mutation.mjs"), R("scripts", "mutation.mjs"));

  // L15: CLAUDE.md carrying every anchor.
  const anchors = ["R1-RATCHET-IS-LAW", "R2-NEVER-MODIFY-RED", "R3-TESTS-IN-LOGOS", "R4-GIT-SPLIT",
    "R5-VENDOR-PRISTINE", "R6-DONE-MEANS-GATE", "R7-DUAL-REPO", "R8-BUILD-DISCIPLINE",
    "R9-FIX-THE-PROCESS", "R10-GIFTS"];
  writeFileSync(R("CLAUDE.md"),
    "# skeleton constitution\n\n" + anchors.map((a) => `<!-- ANCHOR:${a} -->\nrule\n`).join("\n"));

  // L6: two tiny submodules at known heads + a fake oracle binary; pins written to match.
  const bunHead = tinyRepo(R("vendor", "bun"));
  const logHead = tinyRepo(R("vendor", "logicaffeine"));
  const oracle = R("vendor-artifacts", "oracle-bun", "bun");
  writeFileSync(oracle, "#!/bin/sh\necho 1.3.14\n");
  chmodSync(oracle, 0o755);
  const oracleSha = createHash("sha256").update(readFileSync(oracle)).digest("hex");
  writeFileSync(R("SPEC_PIN.md"),
    "# SPEC_PIN\n\n" +
    `| Tag commit SHA | \`${bunHead}\` |\n` +
    `| Binary sha256 | \`${oracleSha}\` |\n`);
  writeFileSync(R("TOOLCHAIN_PIN.md"),
    "# TOOLCHAIN_PIN\n\n" + `| Pinned commit | \`${logHead}\` |\n`);

  // L1-L5 / FREEZE / L17: empty ledger + no gifts → pass trivially. bench: no LEDGER.json → L12
  // empty-suite guard. fuzz: empty → L13 trivial. red/conformance: no *.test.mjs → L16 trivial.
  writeFileSync(R("conformance", "tests-shim-allowlist.tsv"), "# allowlist\n");

  return { dir, gate: R("scripts", "gate.sh") };
}
function runSkelGate(gate) { return run("bash", [gate, "--quick"], { env: { ...process.env } }); }

// ── skeleton POSITIVE CONTROL: the un-mutated skeleton MUST be GREEN ──────────────────
{
  const { gate } = skeleton();
  const r = runSkelGate(gate);
  if (r.code !== 0) {
    fails.push(`SKELETON CONTROL is not GREEN — the whole audit's skeleton plants are unreliable; a plant's RED can no longer be attributed to the plant. output:\n${r.out}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════════════
// (S) gate-structural plants — mutate ONE thing in a fresh skeleton, assert GREEN→RED.
// ════════════════════════════════════════════════════════════════════════════════════

// P-L15: a lost CLAUDE.md anchor.
{
  const { dir, gate } = skeleton();
  const claude = readFileSync(join(dir, "CLAUDE.md"), "utf8").replace("<!-- ANCHOR:R4-GIT-SPLIT -->", "<!-- gone -->");
  writeFileSync(join(dir, "CLAUDE.md"), claude);
  const r = runSkelGate(gate);
  record(r.code !== 0 && /GATE FAIL \[L15\]|lost anchor/i.test(r.out), "L15 lost CLAUDE.md anchor");
}

// P-L6: a pin mismatch (SPEC_PIN tag SHA no longer equals vendor/bun HEAD).
{
  const { dir, gate } = skeleton();
  const spec = readFileSync(join(dir, "SPEC_PIN.md"), "utf8").replace(/Tag commit SHA \| `[0-9a-f]{40}`/, "Tag commit SHA | `" + "0".repeat(40) + "`");
  writeFileSync(join(dir, "SPEC_PIN.md"), spec);
  const r = runSkelGate(gate);
  record(r.code !== 0 && /GATE FAIL \[L6\]|!= pin/i.test(r.out), "L6 pin mismatch (SPEC_PIN vs submodule HEAD)");
}

// P-L7: a dirty vendor tree (an unstaged edit inside vendor/bun).
{
  const { dir, gate } = skeleton();
  writeFileSync(join(dir, "vendor", "bun", "PIN"), "DIRTIED\n");
  const r = runSkelGate(gate);
  record(r.code !== 0 && /GATE FAIL \[L7\]|is dirty/i.test(r.out), "L7 dirty vendor tree");
}

// P-L9: a guarded dir present WITHOUT its guard (bun-engine/ exists, no seam grep-lock).
{
  const { dir, gate } = skeleton();
  mkdirSync(join(dir, "bun-engine", "src"), { recursive: true });
  writeFileSync(join(dir, "bun-engine", "src", "main.zig"), "// engine\n");
  const r = runSkelGate(gate);
  record(r.code !== 0 && /GATE FAIL \[L9\]|guard .* MISSING|engine-seam/i.test(r.out), "L9 guarded dir without guard (bun-engine/ w/o seam grep-lock)");
}

// P-L16: an unallowlisted node test shim in red/.
{
  const { dir, gate } = skeleton();
  writeFileSync(join(dir, "red", "p0", "sneaky.test.mjs"), "// not in the allowlist\n");
  const r = runSkelGate(gate);
  record(r.code !== 0 && /GATE FAIL \[L16\]|unallowlisted/i.test(r.out), "L16 unallowlisted node test shim");
}

// P-L18: a candidate gift with a FLAKY (setTimeout) test → L18 preflight reds the gate (§9.4 inv 7).
// The skeleton's gate.sh runs l18 over conformance/gifts/; a bad candidate there must red the whole
// gate exactly as the empty conformance/gifts/ passed trivially in the positive control.
{
  const { dir, gate } = skeleton();
  const cand = join(dir, "conformance", "gifts", "g-flaky");
  mkdirSync(join(cand, "tree", "test", "js", "web", "url"), { recursive: true });
  writeFileSync(join(cand, "candidate.json"), JSON.stringify({
    id: "G-1", slug: "flaky", security: "n", classification: "theirs",
    behavioralChange: true, isRegression: false, issueNumber: null,
    branch: "claude/gift-flaky", testFile: "test/js/web/url/url.test.ts", prBody: "pr-body.md",
    userSteps: { useSystemBunFails: true, bunBdTestPasses: true, rustCheckAll: true, licenseCla: true },
  }, null, 2) + "\n");
  writeFileSync(join(cand, "pr-body.md"),
    "### What does this PR do?\n\nfix.\n\n### How did you verify your code works?\n\n- ok.\n\n" +
    "### Provenance & authorship disclosure\n\n- differential fuzzing; Claude-authored; clean-room.\n");
  writeFileSync(join(cand, "tree", "test", "js", "web", "url", "url.test.ts"),
    "import { test, expect } from \"bun:test\";\ntest(\"x\", async () => { await new Promise(r => setTimeout(r, 10)); expect(1).toBe(1); });\n");
  const r = runSkelGate(gate);
  record(r.code !== 0 && /GATE FAIL \[L18\]|setTimeout|flaky|invariant 7/i.test(r.out), "L18 flaky candidate gift (setTimeout) reds the gate");
}

// ════════════════════════════════════════════════════════════════════════════════════
// (G) ledger-family plants — REAL gate.sh via LEDGER_GATE_DIR. Whole gate reds.
// ════════════════════════════════════════════════════════════════════════════════════

// P-CHAIN: a hand-edited PASS row (body mutated, chain trailer NOT recomputed) → L1 chain break.
{
  const dir = tmp("gaudit-chain-");
  const body = "# hand edit\nPASS\tA\tsrc/x.lg::a\t" + "a".repeat(40) + "\t3\tpromoted\n";
  // seal the ORIGINAL body, then tamper the body but keep the stale trailer.
  const sealed = sealLedger(body);
  const tampered = sealed.replace("promoted", "HAND-EDITED");
  writeFileSync(join(dir, "p.tsv"), tampered);
  const r = runGateOnLedger(dir);
  record(r.code !== 0 && /GATE FAIL|GATE RED/i.test(r.out), "L1 hand-edited PASS (chain broken)");
}

// P-SHRINK: a PASS set that shrank vs the committed HEAD baseline (monotonicity, L2). Driven with
// a committed baseline .head snapshot listing a PASS key the working ledger no longer carries.
{
  const dir = tmp("gaudit-shrink-");
  const g = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8", stdio: "pipe" });
  g("init", "-q"); g("config", "user.email", "f@t"); g("config", "user.name", "f"); g("config", "commit.gpgsign", "false");
  mkdirSync(join(dir, "conformance", "ledger"), { recursive: true });
  const lp = join(dir, "conformance", "ledger", "p.tsv");
  // committed baseline: TWO PASS rows.
  const baseBody = "# base\nPASS\tA\tsrc/a.lg::a\t" + "a".repeat(40) + "\t2\tp\nPASS\tA\tsrc/b.lg::b\t" + "b".repeat(40) + "\t2\tp\n";
  writeFileSync(lp, sealLedger(baseBody));
  g("add", "-A"); g("commit", "-q", "-m", "baseline two PASS");
  // working tree: DROP the second PASS row (shrunk PASS set). The REAL gate catches this: the
  // ledger's git-HEAD blob is the priorState baseline (SCHEMA §4), so ledger-lint's L2 monotonicity
  // fires on the dropped PASS key even through the LEDGER_GATE_DIR seam (proven, not asserted twice).
  const shrunkBody = "# shrunk\nPASS\tA\tsrc/a.lg::a\t" + "a".repeat(40) + "\t2\tp\n";
  writeFileSync(lp, sealLedger(shrunkBody));
  const r = run("bash", [GATE, "--quick"], { env: { ...process.env, LEDGER_GATE_DIR: join(dir, "conformance", "ledger"), LEDGER_TODAY: "2026-07-13" } });
  record(r.code !== 0 && /monoton|PASS.*dropped|downgraded/i.test(r.out), "L2 shrunk PASS set vs HEAD");
}

// P-HEAD: a committed .tsv.head snapshot beside a ledger (the .head ban, M2) → ledger-lint reds.
{
  const dir = tmp("gaudit-head-");
  const g = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8", stdio: "pipe" });
  g("init", "-q"); g("config", "user.email", "f@t"); g("config", "user.name", "f"); g("config", "commit.gpgsign", "false");
  mkdirSync(join(dir, "conformance", "ledger"), { recursive: true });
  const lp = join(dir, "conformance", "ledger", "p.tsv");
  writeFileSync(lp, sealLedger("# clean\nFAIL\tC\tsrc/x.lg::a\t-\t-\tfrontier\n"));
  writeFileSync(join(dir, "conformance", "ledger", "p.tsv.head"), "snapshot must never be committed\n");
  g("add", "-A", "-f"); g("commit", "-q", "-m", "committed .tsv.head");
  const r = run("node", [join(LINTS, "ledger-lint.mjs"), lp], { env: { ...process.env, LEDGER_TODAY: "2026-07-13" } });
  record(r.code !== 0 && /\.head|head/i.test(r.out), "L1/M2 committed .tsv.head snapshot ban");
}

// P-EXPIRE: an expired QUARANTINE row (expiry in the past) → L3.
{
  const dir = tmp("gaudit-expire-");
  const body = "# expired quarantine\nQUARANTINE(expires=2020-01-01)\tA\tsrc/flaky.lg::f\t" + "a".repeat(40) + "\t1\tflaky\n";
  writeFileSync(join(dir, "p.tsv"), sealLedger(body));
  const r = runGateOnLedger(dir);
  record(r.code !== 0 && /GATE FAIL|GATE RED|expir/i.test(r.out), "L3 expired QUARANTINE");
}

// P-MARKER: a committed .ratchet-break marker (the §9 committed-marker ban) → ledger-lint reds.
{
  const dir = tmp("gaudit-marker-");
  const g = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8", stdio: "pipe" });
  g("init", "-q"); g("config", "user.email", "f@t"); g("config", "user.name", "f"); g("config", "commit.gpgsign", "false");
  mkdirSync(join(dir, "conformance", "ledger"), { recursive: true });
  const lp = join(dir, "conformance", "ledger", "p.tsv");
  writeFileSync(lp, sealLedger("# clean\nFAIL\tC\tsrc/x.lg::a\t-\t-\tfrontier\n"));
  writeFileSync(join(dir, "conformance", "ledger", ".ratchet-break"), "src/x.lg::a\n");
  g("add", "-A", "-f"); g("commit", "-q", "-m", "committed ratchet-break");
  const r = run("node", [join(LINTS, "ledger-lint.mjs"), lp], { env: { ...process.env, LEDGER_TODAY: "2026-07-13" } });
  record(r.code !== 0 && /ratchet-break|marker/i.test(r.out), "L1/§9 committed .ratchet-break marker");
}

// P-FREEZE: a .merge-freeze marker present → the gate REFUSES ("repo frozen").
{
  const dir = tmp("gaudit-freeze-");
  writeFileSync(join(dir, "p.tsv"), sealLedger("# clean\nFAIL\tC\tsrc/x.lg::a\t-\t-\tfrontier\n"));
  writeFileSync(join(dir, ".merge-freeze"), "src/x.lg::a\n");
  const r = runGateOnLedger(dir);
  record(r.code !== 0 && /frozen|FREEZE/i.test(r.out), "FREEZE .merge-freeze blocks the gate");
}

// P-B1-CRASH: an OFF-TAG lint CRASH must RED the gate (the B1 regression guard). Feed a DIRECTORY
// as the ledger arg → ledger-lint throws EISDIR, whose message has NO L-tag substring. The gate
// MUST red on the NONZERO EXIT, not a tag match. We drive the REAL gate via a temp ledger dir that
// contains a *.tsv path which is actually a DIRECTORY (glob picks it up, node read throws).
{
  const dir = tmp("gaudit-b1-");
  // create a directory literally named like a ledger file → the *.tsv glob matches a dir.
  mkdirSync(join(dir, "p.tsv"), { recursive: true });
  const r = runGateOnLedger(dir);
  // the gate must go RED (nonzero) even though the crash message carries no L1/L2/L3 tag.
  const reds = r.code !== 0 && /GATE RED|GATE FAIL/i.test(r.out);
  const notTagOnly = /EISDIR|illegal operation|directory|error/i.test(r.out) || reds; // crash surfaced
  record(reds && notTagOnly, "B1 off-tag lint CRASH (EISDIR, no L-tag) reds the gate");
}

// ════════════════════════════════════════════════════════════════════════════════════
// (T) tool plants — invoke the EXACT tool the gate function wraps.
// ════════════════════════════════════════════════════════════════════════════════════

// P-L4: an in-process-test claimed as a Lane-A PASS → lint-lanes --gate reds (L4).
{
  const fixDir = tmp("gaudit-l4-");
  const tsFile = join(fixDir, "inproc-build.test.ts");
  writeFileSync(tsFile, "import { test } from 'bun:test';\ntest('x', () => { Bun.build({ entrypoints: ['a.ts'] }); });\n");
  const badRow = `PASS\tA\t${tsFile}\t${"a".repeat(40)}\t3\tclaimed Lane-A green`;
  const r = run("node", [join(ROOT, "conformance", "lint-lanes.mjs"), "--gate"], { input: badRow + "\n" });
  record(r.code !== 0 && /BLOCKED\(P9\)|Bun\.build|in-process/i.test(r.out), "L4 in-process test as Lane-A PASS");
}

// P-L5: an assert-parity DROP (PASS asserts=5, run store current=3) → assert-parity-lint reds (L5).
{
  const dir = tmp("gaudit-l5-");
  mkdirSync(join(dir, "runs"), { recursive: true });
  const key = "src/toy.lg::good";
  writeFileSync(join(dir, "p0.tsv"), sealLedger(`PASS\tA\t${key}\t${"a".repeat(40)}\t5\tpromoted\n`));
  writeFileSync(join(dir, "runs", "p0.runs.tsv"), sealLedger(`2026-07-12T00:00:00Z\t${key}\tpass\t3\n`));
  const r = run("node", [join(LINTS, "assert-parity-lint.mjs"), join(dir, "p0.tsv")], { env: { ...process.env, LEDGER_TODAY: "2026-07-13" } });
  record(r.code !== 0 && /L5 assert-parity/i.test(r.out), "L5 assert-parity drop");
}

// P-L8: a fixture script containing `git reset --hard` → workflow-ops-lint exit 7 (L8).
{
  const dir = tmp("gaudit-l8-");
  mkdirSync(join(dir, "scripts"), { recursive: true });
  writeFileSync(join(dir, "scripts", "bad.sh"), "#!/usr/bin/env bash\ngit reset --hard HEAD\n");
  const r = run("node", [join(LINTS, "workflow-ops-lint.mjs"), "--root", dir]);
  record(r.code === 7 && /forbidden|reset/i.test(r.out), "L8 forbidden git verb in a script");
}

// P-L17a: an illegal gift-lifecycle transition (found→filed, skipping classified) → gifts-lint reds.
{
  const dir = tmp("gaudit-l17a-");
  const body =
    "# g: illegal found -> filed\n" +
    "G-9\tfound\t-\tn\t-\tdifferential mismatch\n" +
    "G-9\tfiled\ttheirs\tn\thttps://github.com/oven-sh/bun/pull/1\tfiled without classifying\n";
  writeFileSync(join(dir, "gifts.tsv"), sealLedger(body));
  const r = run("node", [join(LINTS, "gifts-lint.mjs"), join(dir, "gifts.tsv")]);
  record(r.code !== 0 && /transition|illegal|classif/i.test(r.out), "L17 illegal gift transition");
}

// P-L17b: a security=y finding leaking a PUBLIC issue URL (invariant 10) → gifts-lint reds.
{
  const dir = tmp("gaudit-l17b-");
  const body =
    "# g: security leak\n" +
    "G-8\tfound\t-\ty\t-\tUAF in the archive extractor\n" +
    "G-8\tclassified\ttheirs\ty\t-\trouted to security@bun.com\n" +
    "G-8\tembargoed\ttheirs\ty\thttps://github.com/oven-sh/bun/issues/12345\tLEAK public issue URL\n";
  writeFileSync(join(dir, "gifts.tsv"), sealLedger(body));
  const r = run("node", [join(LINTS, "gifts-lint.mjs"), join(dir, "gifts.tsv")]);
  record(r.code !== 0 && /invariant 10|security|public/i.test(r.out), "L17 security-public-link (embargo leak)");
}

// ════════════════════════════════════════════════════════════════════════════════════
// (T) commit.mjs refusal plants — a throwaway git repo standing in for logos-bun.
// ════════════════════════════════════════════════════════════════════════════════════
function commitFixtureRepo() {
  const dir = tmp("gaudit-commit-");
  const g = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8", stdio: "pipe" });
  g("init", "-q"); g("config", "user.email", "f@t"); g("config", "user.name", "f"); g("config", "commit.gpgsign", "false");
  mkdirSync(join(dir, "work", "cards"), { recursive: true });
  mkdirSync(join(dir, "red", "p0", "demo"), { recursive: true });
  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "vendor", "bun"), { recursive: true });
  mkdirSync(join(dir, "scripts"), { recursive: true });
  writeFileSync(join(dir, "work", "cards", "WX.1-demo.md"),
    "# WX.1 — demo\n\nrepo: logos-bun\n\n## Manifest\nsrc/**, red/p0/demo/**\n");
  writeFileSync(join(dir, "scripts", "gate.sh"), "#!/usr/bin/env bash\nexit 0\n");
  execFileSync("chmod", ["+x", join(dir, "scripts", "gate.sh")]);
  writeFileSync(join(dir, "red", "p0", "demo", "spec.test.mjs"), "// red spec\n");
  writeFileSync(join(dir, "src", "impl.txt"), "impl\n");
  return dir;
}
const COMMIT = join(ROOT, "scripts", "workflow", "commit.mjs");

// P-COMMIT3: an out-of-manifest path → exit 3.
{
  const dir = commitFixtureRepo();
  writeFileSync(join(dir, "elsewhere.txt"), "nope\n");
  const r = run("node", [COMMIT, "--root", dir, "--card", "WX.1", "--paths", "elsewhere.txt", "-m", "x"]);
  record(r.code === 3, "commit.mjs out-of-manifest path (exit 3)");
}

// P-COMMIT4: a vendor/** path → exit 4.
{
  const dir = commitFixtureRepo();
  writeFileSync(join(dir, "vendor", "bun", "touched.txt"), "nope\n");
  const r = run("node", [COMMIT, "--root", dir, "--card", "WX.1", "--paths", "vendor/bun/touched.txt", "-m", "x"]);
  record(r.code === 4, "commit.mjs vendor path (exit 4)");
}

// P-COMMIT5: an impl file while the card's RED path has no committed history → exit 5 (L10).
{
  const dir = commitFixtureRepo();
  const r = run("node", [COMMIT, "--root", dir, "--card", "WX.1", "--paths", "src/impl.txt", "-m", "impl before red"]);
  record(r.code === 5, "commit.mjs impl-before-RED (exit 5 / L10)");
}

// ── verdict ─────────────────────────────────────────────────────────────────────────
for (const d of cleanup) rmSync(d, { recursive: true, force: true });

if (caught < VIOLATIONS_CAUGHT_FLOOR) {
  fails.push(`VIOLATIONS_CAUGHT floor breach: caught ${caught} < floor ${VIOLATIONS_CAUGHT_FLOOR} — the gate stopped catching a planted violation (a regression the meta-lock exists to freeze on).`);
}

if (fails.length) {
  for (const f of fails) console.error("FAIL gate-audit: " + f);
  process.exit(1);
}
console.log(`PASS gate-audit — ${caught} planted violation(s) caught (floor ${VIOLATIONS_CAUGHT_FLOOR})`);
