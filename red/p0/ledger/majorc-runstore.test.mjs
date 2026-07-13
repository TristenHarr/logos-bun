// W1.1 RED (review-2 MAJOR-C / blast m3): run-store verdict + timestamp validation.
//   (a) a `skip`-verdict fail-in-disguise inside the promotion window → promote REFUSES and the
//       structural run-store lint REDs (only {pass,fail} are valid verdicts).
//   (b) `…T00:00:00Z` and `…T00:00:00.000Z` must count as ONE timestamp, not two: the pinned
//       format REJECTS the sub-second form, so a 5/5 window that leans on `…000Z` to fake a
//       second distinct timestamp is refused (single-sitting flake defence holds).
// Both are driven through the real promote.mjs + ledger-lint.mjs. A POSITIVE CONTROL (a genuine
// 5/5 across 2 pinned timestamps) promotes, so a refusal can never be a crash-in-disguise.
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const PROMOTE = join(ROOT, "scripts", "promote.mjs");
const LINT = join(ROOT, "scripts", "lints", "ledger-lint.mjs");
const { chainDigest, GENESIS } = await import(LINT);
const fails = [];
const SHA = "abc1230000000000000000000000000000000000";
const KEY = "src/toy.lg::k";

const seal = (body) => body + "#CHAIN " + chainDigest(GENESIS, body) + "\n";
const mkFix = (runRows) => {
  const dir = mkdtempSync(join(tmpdir(), "mc-"));
  mkdirSync(join(dir, "runs"), { recursive: true });
  writeFileSync(join(dir, "ledger.tsv"), seal(`# mc\nFAIL\tC\t${KEY}\t-\t-\tcandidate\n`));
  writeFileSync(join(dir, "runs", "ledger.runs.tsv"), seal("# runs\n" + runRows.map((r) => r.join("\t")).join("\n") + "\n"));
  return dir;
};
const promote = (dir) => {
  try {
    const out = execFileSync("node", [PROMOTE, "--ledger", join(dir, "ledger.tsv"), "--key", KEY],
      { encoding: "utf8", env: { ...process.env, LEDGER_TODAY: "2026-07-13", LEDGER_HEAD_SHA: SHA } });
    return { code: 0, out };
  } catch (e) { return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") }; }
};
const lint = (dir) => {
  try {
    const out = execFileSync("node", [LINT, join(dir, "ledger.tsv")],
      { encoding: "utf8", env: { ...process.env, LEDGER_TODAY: "2026-07-13" } });
    return { code: 0, out };
  } catch (e) { return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") }; }
};
const promoted = (dir) => new RegExp("^PASS\\tC\\t" + KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\t", "m").test(readFileSync(join(dir, "ledger.tsv"), "utf8"));

// ── (control) 5 pass across 2 pinned timestamps → promotes ─────────────────────
{
  const dir = mkFix([
    ["2026-07-05T00:00:00Z", KEY, "pass", "3"], ["2026-07-05T00:00:00Z", KEY, "pass", "3"],
    ["2026-07-06T00:00:00Z", KEY, "pass", "3"], ["2026-07-06T00:00:00Z", KEY, "pass", "3"], ["2026-07-06T00:00:00Z", KEY, "pass", "3"],
  ]);
  const r = promote(dir);
  if (r.code !== 0 || !promoted(dir)) fails.push(`control: a genuine 5/5-across-2-pinned-ts candidate did not promote; output:\n${r.out}`);
}

// ── (a) skip-verdict fail-in-disguise in the window → refuse + structural RED ───
{
  const dir = mkFix([
    ["2026-07-05T00:00:00Z", KEY, "pass", "3"], ["2026-07-05T00:00:00Z", KEY, "skip", "3"],
    ["2026-07-06T00:00:00Z", KEY, "pass", "3"], ["2026-07-06T00:00:00Z", KEY, "pass", "3"], ["2026-07-06T00:00:00Z", KEY, "pass", "3"],
  ]);
  const r = promote(dir);
  if (r.code === 0 || promoted(dir)) fails.push(`(a): promote accepted a window containing a "skip" verdict (fail-in-disguise); output:\n${r.out}`);
  const l = lint(dir);
  if (l.code === 0) fails.push(`(a): the structural run-store lint did not RED on a "skip" verdict; output:\n${l.out}`);
  if (!/verdict/i.test(l.out)) fails.push(`(a): the run-store lint failure did not mention the bad verdict; output:\n${l.out}`);
}

// ── (b) `…Z` vs `…000Z` count as ONE ts (sub-second form rejected) → refuse ─────
{
  const dir = mkFix([
    ["2026-07-05T00:00:00Z", KEY, "pass", "3"], ["2026-07-05T00:00:00.000Z", KEY, "pass", "3"],
    ["2026-07-05T00:00:00Z", KEY, "pass", "3"], ["2026-07-05T00:00:00.000Z", KEY, "pass", "3"], ["2026-07-05T00:00:00Z", KEY, "pass", "3"],
  ]);
  const r = promote(dir);
  if (r.code === 0 || promoted(dir)) fails.push(`(b): promote accepted a window that fakes a 2nd timestamp via the sub-second "…000Z" form; output:\n${r.out}`);
  const l = lint(dir);
  if (l.code === 0) fails.push(`(b): the structural run-store lint did not RED on the sub-second ts form; output:\n${l.out}`);
}

if (fails.length) {
  for (const f of fails) console.error("FAIL majorc-runstore: " + f);
  process.exit(1);
}
console.log("PASS majorc-runstore");
