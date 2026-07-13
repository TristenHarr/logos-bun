// W2.8 RED — the gift pre-push review-gate (BAKE_A_BUN §9.4 invariants 4-9, 13, 14, 17, 18).
// scripts/gift/preflight.mjs turns a candidate gift into a PR-ready one by MECHANIZING what can
// be mechanized and EMITTING (never faking) the steps that need a built bun + the gift checkout.
//
// The contract this battery pins:
//   • `node preflight.mjs --check-dir <candidateDir>` validates ONE candidate. Exit 0 = the
//     candidate is PR-ready-eligible (every mechanized check passed AND the user has RECORDED
//     every [USER] step as passing). Any nonzero exit = rejected.
//   • preflight ALWAYS emits the [USER] step block (the exact commands + a checklist) to stdout,
//     whether it passes or fails — the user runs those against the gift checkout. It NEVER
//     auto-passes them: a candidate whose [USER] steps are unrecorded is PENDING, not ready.
//   • `--check-all <root>` / `--gate` iterate the candidates root; an EMPTY root passes trivially
//     (the l17-style empty guard — no candidate gifts yet ⇒ GIFT.4 stays honestly open).
//
// Each plant is a hermetic temp candidate tree; NEVER the live tree. Read-only git.
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

// the SHARED chain digest (SCHEMA §4), computed exactly as ledger-lint's chainDigest(prev, body).
// The gifts ledger the cap-reader consumes must be sealed with this so gifts-lint accepts it.
const CHAIN_GENESIS = "0".repeat(64);
const chainDigest = (prev, body) =>
  createHash("sha256").update(Buffer.concat([Buffer.from(prev, "utf8"), Buffer.from(body, "utf8")])).digest("hex");
function writeGiftsLedger(path, body) {
  writeFileSync(path, body + "#CHAIN " + chainDigest(CHAIN_GENESIS, body) + "\n");
}

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const PREFLIGHT = join(ROOT, "scripts", "gift", "preflight.mjs");

const fails = [];
const cleanup = [];
const tmp = (p) => { const d = mkdtempSync(join(tmpdir(), p)); cleanup.push(d); return d; };

// run preflight; never throws (a nonzero exit is an expected outcome for a reject plant).
function preflight(...args) {
  try {
    const out = execFileSync("node", [PREFLIGHT, ...args], { encoding: "utf8", stdio: "pipe" });
    return { code: 0, out };
  } catch (e) {
    return { code: typeof e.status === "number" ? e.status : 1, out: (e.stdout || "") + (e.stderr || "") };
  }
}

// a bun-format test body that is well-behaved: awaits its condition, no setTimeout, exact assert.
const GOOD_TEST = `import { test, expect } from "bun:test";
test("url.parse edge normalizes host", () => {
  const u = new URL("http://EXAMPLE.com/a");
  expect(u.hostname).toBe("example.com");
});
`;

// a flaky test body: uses setTimeout (invariant 7 forbids it outright).
const FLAKY_TEST = `import { test, expect } from "bun:test";
test("eventually", async () => {
  await new Promise((r) => setTimeout(r, 50));
  expect(1).toBe(1);
});
`;

// a well-formed PR body: two bun headings + the mandatory provenance block, comments ≤ 3 lines.
const GOOD_PR_BODY = `### What does this PR do?

Fixes url.parse host-casing divergence at the layer that owns hostname normalization.

### How did you verify your code works?

- Fails on the unfixed build: \`USE_SYSTEM_BUN=1 bun test <file>\`.
- Passes on the fix: \`bun bd test <file>\`.

### Provenance & authorship disclosure

- How this was found: differential fuzzing vs an independent LOGOS reimplementation.
- Authorship: Claude-authored, human-reviewed.
- License & derivation: clean-room, nothing derived from BSL logos-bun/logicaffeine sources.
`;

// write a candidate gift directory. opts control which plant we're building.
function candidate(opts = {}) {
  const dir = tmp("preflight-cand-");
  const {
    id = "G-1",
    slug = "url-parse-host",
    security = "n",
    classification = "theirs",
    behavioralChange = true,
    isRegression = false,
    issueNumber = null,
    testRelPath = "test/js/web/url/url.test.ts",
    testBody = GOOD_TEST,
    prBody = GOOD_PR_BODY,
    // [USER] step results: null = not run yet (PENDING); true = user recorded a pass.
    userSteps = { useSystemBunFails: true, bunBdTestPasses: true, rustCheckAll: true, licenseCla: true },
    writeTest = true,
  } = opts;

  const meta = {
    id, slug, security, classification, behavioralChange, isRegression, issueNumber,
    branch: `claude/gift-${slug}`,
    testFile: testRelPath,
    prBody: "pr-body.md",
    userSteps,
  };
  writeFileSync(join(dir, "candidate.json"), JSON.stringify(meta, null, 2) + "\n");
  writeFileSync(join(dir, "pr-body.md"), prBody);
  if (writeTest) {
    const tp = join(dir, "tree", testRelPath);
    mkdirSync(dirname(tp), { recursive: true });
    writeFileSync(tp, testBody);
  }
  return dir;
}

// ── PLANT 1: a valid candidate PASSES, and the [USER] steps are EMITTED (not auto-passed) ──────
{
  const dir = candidate();
  const r = preflight("--check-dir", dir);
  if (r.code !== 0) fails.push(`a fully-valid candidate (all mechanized checks + all [USER] steps recorded) was REJECTED (want exit 0); output:\n${r.out}`);
  // the [USER] steps must be EMITTED verbatim so the user can run them — the anti-fake proof.
  if (!/USE_SYSTEM_BUN=1/.test(r.out)) fails.push(`preflight did not EMIT the invariant-6 USE_SYSTEM_BUN command for the user to run; output:\n${r.out}`);
  if (!/bun bd test/.test(r.out)) fails.push(`preflight did not EMIT the invariant-6 \`bun bd test\` command; output:\n${r.out}`);
  if (!/rust:check-all|zig:check-all/.test(r.out)) fails.push(`preflight did not EMIT the invariant-14 cross-platform check command; output:\n${r.out}`);
  if (!/\[USER\]/.test(r.out)) fails.push(`preflight did not mark the human-run steps as [USER]; output:\n${r.out}`);
}

// ── PLANT 2: a regression test named test/regression/issue/FAKE → REJECTED (needs a real N) ─────
{
  const dir = candidate({
    isRegression: true,
    issueNumber: "FAKE",
    testRelPath: "test/regression/issue/FAKE.test.ts",
  });
  const r = preflight("--check-dir", dir);
  if (r.code === 0) fails.push(`a regression test in test/regression/issue/FAKE (placeholder issue number) was ACCEPTED (want nonzero — invariant 5 requires a REAL GitHub issue number); output:\n${r.out}`);
  if (!/regression|issue|real|FAKE|invariant 5/i.test(r.out)) fails.push(`rejection did not mention the fake regression issue number; output:\n${r.out}`);
}

// ── PLANT 2b: a regression test with a real N in the WRONG folder path is caught too ───────────
// (an issueNumber that doesn't match the file name is a mismatch — the file name must be <N>.test.ts)
{
  const dir = candidate({
    isRegression: true,
    issueNumber: "12345",
    testRelPath: "test/regression/issue/99999.test.ts", // file name ≠ declared issue number
  });
  const r = preflight("--check-dir", dir);
  if (r.code === 0) fails.push(`a regression whose file name (99999) disagrees with its declared issue number (12345) was ACCEPTED (want nonzero); output:\n${r.out}`);
}

// ── PLANT 3: a behavioral change with NO test → REJECTED (invariant 4) ─────────────────────────
{
  const dir = candidate({ behavioralChange: true, writeTest: false });
  const r = preflight("--check-dir", dir);
  if (r.code === 0) fails.push(`a behavioral change shipping NO test file was ACCEPTED (want nonzero — invariant 4 requires an automated test in the same PR); output:\n${r.out}`);
  if (!/test|invariant 4|behavioral/i.test(r.out)) fails.push(`rejection did not mention the missing test; output:\n${r.out}`);
}

// ── PLANT 3b: a behavioral change whose test is in a NON-bun folder → REJECTED (invariant 4/5) ─
{
  const dir = candidate({ testRelPath: "src/somewhere/adhoc.test.ts" }); // not test/js|cli|bundler|regression
  const r = preflight("--check-dir", dir);
  if (r.code === 0) fails.push(`a test outside bun's format/folders (src/somewhere/) was ACCEPTED (want nonzero — invariant 4 requires bun's folder layout); output:\n${r.out}`);
}

// ── PLANT 4: a flaky test (setTimeout) → REJECTED (invariant 7) ────────────────────────────────
{
  const dir = candidate({ testBody: FLAKY_TEST });
  const r = preflight("--check-dir", dir);
  if (r.code === 0) fails.push(`a flaky test using setTimeout was ACCEPTED (want nonzero — invariant 7 forbids setTimeout, await the condition); output:\n${r.out}`);
  if (!/setTimeout|flaky|invariant 7/i.test(r.out)) fails.push(`rejection did not mention the setTimeout flake; output:\n${r.out}`);
}

// ── PLANT 5: an over-cap state (N+1 ready) → REFUSES the new ready (invariant 17) ──────────────
// A candidates root already holding N gifts in `ready`/`filed`/`in-review` (open) plus a NEW
// candidate that would push it over the standing cap → preflight refuses to mark the new one ready.
{
  const root = tmp("preflight-root-");
  // build a small gifts ledger recording N already-open findings (cap default is small).
  // preflight reads upstream-gifts.tsv OPEN state; over-cap must refuse.
  const CAP = 3;
  const openLedger = [];
  for (let i = 1; i <= CAP; i++) {
    openLedger.push(`G-${i}\tfound\t-\tn\t-\topen ${i}`);
    openLedger.push(`G-${i}\tclassified\ttheirs\tn\t-\topen ${i}`);
    openLedger.push(`G-${i}\tready\ttheirs\tn\tconformance/gifts/g-${i}/\topen ${i}`);
  }
  // seal via the SHARED chain so gifts-lint accepts the ledger the cap-check reads.
  const gtsv = join(root, "upstream-gifts.tsv");
  writeGiftsLedger(gtsv, openLedger.join("\n") + "\n");
  // a fresh candidate that wants to become ready — the (N+1)th.
  const dir = candidate({ id: "G-99", slug: "new-over-cap" });
  const r = preflight("--check-dir", dir, "--cap", String(CAP), "--gifts-ledger", gtsv, "--want-ready");
  if (r.code === 0) fails.push(`preflight marked an (N+1)th gift ready over the standing cap of ${CAP} (want nonzero — invariant 17 caps open gift PRs); output:\n${r.out}`);
  if (!/cap|open|invariant 17|rate/i.test(r.out)) fails.push(`over-cap refusal did not mention the cap; output:\n${r.out}`);
}

// ── PLANT 6: a PR body with a >3-line diff-comment block → REJECTED (invariant 18) ────────────
{
  const longComment = `### What does this PR do?

Fixes it.

### How did you verify your code works?

- Passes: \`bun bd test <file>\`.

### Provenance & authorship disclosure

- How this was found: differential fuzzing vs an independent LOGOS reimplementation.
- Authorship: Claude-authored, human-reviewed.
- License & derivation: clean-room.

<!--
this
review comment
is way
too many
lines
-->
`;
  const dir = candidate({ prBody: longComment });
  const r = preflight("--check-dir", dir);
  if (r.code === 0) fails.push(`a PR body carrying a >3-line comment block was ACCEPTED (want nonzero — invariant 18 caps comments at 3 lines); output:\n${r.out}`);
}

// ── PLANT 7: a PENDING candidate (a [USER] step unrecorded) is NOT auto-passed ─────────────────
// The load-bearing anti-fake test: preflight must NOT fake-pass a step it cannot mechanically run.
{
  const dir = candidate({ userSteps: { useSystemBunFails: null, bunBdTestPasses: null, rustCheckAll: null, licenseCla: null } });
  const r = preflight("--check-dir", dir);
  if (r.code === 0) fails.push(`a candidate with UNRECORDED [USER] steps was reported PR-ready (want nonzero — preflight must NEVER auto-pass a [USER] step; it emits the commands and waits for the user's recorded result); output:\n${r.out}`);
  if (!/PENDING|\[USER\]|not.*run|record/i.test(r.out)) fails.push(`pending candidate did not surface that [USER] steps are unrun; output:\n${r.out}`);
  // even while PENDING, the commands must be emitted so the user knows what to run.
  if (!/USE_SYSTEM_BUN=1/.test(r.out) || !/bun bd test/.test(r.out)) fails.push(`a PENDING candidate did not EMIT the [USER] commands; output:\n${r.out}`);
}

// ── PLANT 7b: a candidate that FAILED a [USER] step (recorded false) → REJECTED ────────────────
// invariant 6: the test passing under USE_SYSTEM_BUN=1 means it is NOT a valid gift.
{
  const dir = candidate({ userSteps: { useSystemBunFails: false, bunBdTestPasses: true, rustCheckAll: true, licenseCla: true } });
  const r = preflight("--check-dir", dir);
  if (r.code === 0) fails.push(`a candidate whose test PASSED under USE_SYSTEM_BUN=1 (recorded useSystemBunFails=false) was accepted (want nonzero — invariant 6: a test that passes with the system bun is NOT a valid gift); output:\n${r.out}`);
}

// ── PLANT 8: EMPTY candidates root → --check-all passes TRIVIALLY (the l17-style empty guard) ──
{
  const root = tmp("preflight-empty-");
  const r = preflight("--check-all", "--candidates", root);
  if (r.code !== 0) fails.push(`--check-all over an EMPTY candidates root did not pass trivially (want exit 0 — the empty guard; no gifts yet ⇒ GIFT.4 stays open); output:\n${r.out}`);
}

// ── PLANT 9: a security=y candidate stays EMBARGOED through preflight (never a public PR) ──────
// invariant 10: a security finding must NOT be turned into a public-PR-ready gift. preflight must
// refuse to mark a security=y candidate `ready` — it routes to security@bun.com instead.
{
  const dir = candidate({ id: "G-7", slug: "uaf-css", security: "y" });
  const r = preflight("--check-dir", dir, "--want-ready");
  if (r.code === 0) fails.push(`a security=y candidate was marked PR-ready (want nonzero — invariant 10: security findings route to security@bun.com, NEVER a public PR); output:\n${r.out}`);
  if (!/security|embargo|security@bun\.com|invariant 10/i.test(r.out)) fails.push(`security refusal did not mention the embargo route; output:\n${r.out}`);
}

// ── verdict ────────────────────────────────────────────────────────────────────────────────
for (const d of cleanup) rmSync(d, { recursive: true, force: true });

if (fails.length) {
  for (const f of fails) console.error("FAIL preflight: " + f);
  process.exit(1);
}
console.log("PASS preflight — valid candidate passes with [USER] steps EMITTED; fake-N / no-test / non-bun-folder / flaky / over-cap / long-comment / pending / sys-bun-pass / security-embargo all rejected; empty root trivially green");
