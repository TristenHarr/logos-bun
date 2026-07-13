// W1.1 RED m1/m2 (blast M1/M2 + review-1 F1/F2, review-2 BLOCKER-A/B): the prior-state layer.
// Each case builds a throwaway git repo whose HEAD holds a committed ledger, then lints under
// the real ledger-lint.mjs. Cases:
//   (M1a) a committed, UNCHANGED, .head-less ledger PASSES L1 — no self-fixed-point. The whole
//         review round tripped here: the absolute-path invocation used to hash the file's OWN
//         committed trailer into its own chain (unsatisfiable) → RED on a clean tree.
//   (M1b) a RELATIVE-path invocation PRESERVES the HEAD monotonicity baseline. A relative-path
//         lint that DROPS a committed PASS must RED (the old basename fallback silently wiped the
//         baseline → GENESIS → the drop passed).
//   (M2a) a committed *.tsv.head snapshot at HEAD → lint exit 1 (the .head seam forges the
//         baseline; it must be gitignored + banned at HEAD).
//   (M2b) a git mv / git rm that ERASES a committed baseline PASS set → RED via HEAD-baseline
//         enumeration (LEDGER_LINT_BASELINE), even though the vanished ledger is gone from the
//         working tree.
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const LINT = join(ROOT, "scripts", "lints", "ledger-lint.mjs");
const { chainDigest, GENESIS } = await import(LINT);
const fails = [];

const seal = (body) => body + "#CHAIN " + chainDigest(GENESIS, body) + "\n";
// a legal PASS body (real 40-hex first-green, non-zero) + a FAIL frontier row.
const passRow = (key, sha, asserts) => `PASS\tC\t${key}\t${sha}\t${asserts}\tproven\n`;
const SHA = "abc1230000000000000000000000000000000000";

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "m1m2-"));
  const git = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8", stdio: "pipe" });
  git("init", "-q");
  git("config", "user.email", "fixture@logos-bun.test");
  git("config", "user.name", "fixture");
  git("config", "commit.gpgsign", "false");
  mkdirSync(join(dir, "conformance", "ledger"), { recursive: true });
  return { dir, git };
}
// lint a path; `rel` optional relative-cwd invocation (from `dir`).
function lint(dir, arg, extraEnv = {}) {
  try {
    const out = execFileSync("node", [LINT, arg], {
      cwd: dir, encoding: "utf8", env: { ...process.env, LEDGER_TODAY: "2026-07-13", ...extraEnv },
    });
    return { code: 0, out };
  } catch (e) { return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") }; }
}

// ── (M1a) committed unchanged ledger PASSES L1 (absolute path) ─────────────────
{
  const { dir, git } = makeRepo();
  const lp = join(dir, "conformance", "ledger", "p.tsv");
  writeFileSync(lp, seal("# clean\n" + passRow("src/x.lg::a", SHA, "2")));
  // provide the run-store evidence so the new-key PASS provenance holds.
  mkdirSync(join(dir, "conformance", "ledger", "runs"), { recursive: true });
  const rbody = "# runs\n" +
    "2026-07-05T00:00:00Z\tsrc/x.lg::a\tpass\t2\n2026-07-05T00:00:00Z\tsrc/x.lg::a\tpass\t2\n" +
    "2026-07-06T00:00:00Z\tsrc/x.lg::a\tpass\t2\n2026-07-06T00:00:00Z\tsrc/x.lg::a\tpass\t2\n2026-07-06T00:00:00Z\tsrc/x.lg::a\tpass\t2\n";
  writeFileSync(join(dir, "conformance", "ledger", "runs", "p.runs.tsv"), seal(rbody));
  git("add", "-A"); git("commit", "-q", "-m", "seed");
  const r = lint(dir, lp);  // absolute path
  if (r.code !== 0) fails.push(`M1a: committed unchanged ledger FAILED its own lint (self-fixed-point regression); output:\n${r.out}`);
  rmSync(dir, { recursive: true, force: true });
}

// ── (M1b) relative-path invocation PRESERVES the HEAD PASS baseline ────────────
{
  const { dir, git } = makeRepo();
  const rel = "conformance/ledger/p.tsv";
  const lp = join(dir, rel);
  mkdirSync(join(dir, "conformance", "ledger", "runs"), { recursive: true });
  const rbody = "# runs\n" +
    "2026-07-05T00:00:00Z\tsrc/x.lg::a\tpass\t2\n2026-07-05T00:00:00Z\tsrc/x.lg::a\tpass\t2\n" +
    "2026-07-06T00:00:00Z\tsrc/x.lg::a\tpass\t2\n2026-07-06T00:00:00Z\tsrc/x.lg::a\tpass\t2\n2026-07-06T00:00:00Z\tsrc/x.lg::a\tpass\t2\n";
  writeFileSync(join(dir, "conformance", "ledger", "runs", "p.runs.tsv"), seal(rbody));
  writeFileSync(lp, seal("# baseline\n" + passRow("src/x.lg::a", SHA, "2")));
  git("add", "-A"); git("commit", "-q", "-m", "seed PASS");
  // now DROP the PASS in the working tree (downgrade to FAIL) WITHOUT ceremony.
  writeFileSync(lp, seal("# dropped\nFAIL\tC\tsrc/x.lg::a\t-\t-\tsecretly dropped\n"));
  const r = lint(dir, rel);  // RELATIVE path invocation
  if (r.code === 0) fails.push(`M1b: a RELATIVE-path lint let a committed PASS silently drop (baseline wiped to GENESIS); output:\n${r.out}`);
  if (!/monoton|PASS/i.test(r.out)) fails.push(`M1b: the drop failure did not mention monotonicity; output:\n${r.out}`);
  rmSync(dir, { recursive: true, force: true });
}

// ── (M2a) a committed *.tsv.head snapshot at HEAD → RED ────────────────────────
{
  const { dir, git } = makeRepo();
  const lp = join(dir, "conformance", "ledger", "p.tsv");
  writeFileSync(lp, seal("# clean\nFAIL\tC\tsrc/x.lg::a\t-\t-\tfrontier\n"));
  // a committed .head snapshot (the forgeable baseline) — must be banned.
  writeFileSync(lp + ".head", seal("# forged baseline\n"));
  git("add", "-A", "-f"); git("commit", "-q", "-m", "seed + committed .head");
  const r = lint(dir, lp);
  if (r.code === 0) fails.push(`M2a: a committed *.tsv.head at HEAD did not RED the lint (forgeable baseline); output:\n${r.out}`);
  if (!/\.head/i.test(r.out)) fails.push(`M2a: the failure did not mention the committed .head ban; output:\n${r.out}`);
  rmSync(dir, { recursive: true, force: true });
}

// ── (M2b) rename/delete ERASES a committed baseline PASS set → RED ─────────────
{
  const { dir, git } = makeRepo();
  const lp = join(dir, "conformance", "ledger", "p.tsv");
  mkdirSync(join(dir, "conformance", "ledger", "runs"), { recursive: true });
  const rbody = "# runs\n" +
    "2026-07-05T00:00:00Z\tsrc/x.lg::a\tpass\t2\n2026-07-05T00:00:00Z\tsrc/x.lg::a\tpass\t2\n" +
    "2026-07-06T00:00:00Z\tsrc/x.lg::a\tpass\t2\n2026-07-06T00:00:00Z\tsrc/x.lg::a\tpass\t2\n2026-07-06T00:00:00Z\tsrc/x.lg::a\tpass\t2\n";
  writeFileSync(join(dir, "conformance", "ledger", "runs", "p.runs.tsv"), seal(rbody));
  writeFileSync(lp, seal("# baseline PASS\n" + passRow("src/x.lg::a", SHA, "2")));
  git("add", "-A"); git("commit", "-q", "-m", "seed proven PASS");
  // git rm the whole ledger from the working tree (erasing the proven PASS set).
  git("rm", "-q", "conformance/ledger/p.tsv");
  // the gate enumerates HEAD baselines via LEDGER_LINT_BASELINE; lint the vanished baseline.
  const r = lint(dir, lp, { LEDGER_LINT_BASELINE: "p.tsv" });
  if (r.code === 0) fails.push(`M2b: a git rm that erased a committed PASS set was NOT caught by HEAD-baseline enumeration; output:\n${r.out}`);
  if (!/monoton|dropped|PASS/i.test(r.out)) fails.push(`M2b: the erased-PASS failure did not mention monotonicity; output:\n${r.out}`);
  rmSync(dir, { recursive: true, force: true });
}

if (fails.length) {
  for (const f of fails) console.error("FAIL m1m2-baseline: " + f);
  process.exit(1);
}
console.log("PASS m1m2-baseline");
