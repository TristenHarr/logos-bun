// W1.1 RED (review-1 FINDING 4): the SCHEMA §5 transition table is enforced for NON-PASS
// baseline rows, not just PASS shrinks. A baseline `DIVERGE(reason)` is a permanent stance —
// it may never transition. Flipping it to FAIL (the DIVERGE→FAIL→promote→PASS laundering path)
// must RED even though the PASS set is untouched. A NOTIMPL→QUARANTINE jump is likewise
// forbidden. The baseline is planted hermetically via the `.head` snapshot (§4 step 1), and a
// CONTROL (a legal NOTIMPL→FAIL, which IS allowed) PASSES — so the failure is specific to the
// FORBIDDEN transition, not any change at all.
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const LINT = join(ROOT, "scripts", "lints", "ledger-lint.mjs");
const { chainDigest, GENESIS } = await import(LINT);
const fails = [];

// build a fixture: baseline (.head) planted, then a working ledger chained onto the .head trailer.
function mkFix(baselineBody, workBody) {
  const dir = mkdtempSync(join(tmpdir(), "f4t-"));
  const headText = baselineBody + "#CHAIN " + chainDigest(GENESIS, baselineBody) + "\n";
  const headTrailer = chainDigest(GENESIS, baselineBody);
  writeFileSync(join(dir, "ledger.tsv.head"), headText);
  writeFileSync(join(dir, "ledger.tsv"), workBody + "#CHAIN " + chainDigest(headTrailer, workBody) + "\n");
  return dir;
}
const lint = (dir) => {
  try {
    const out = execFileSync("node", [LINT, join(dir, "ledger.tsv")],
      { encoding: "utf8", env: { ...process.env, LEDGER_TODAY: "2026-07-13" } });
    return { code: 0, out };
  } catch (e) { return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") }; }
};

const DIVERGE = "DIVERGE(telemetry no-op)\tC\tsrc/a.lg::phone_home\t-\t-\twe never phone home\n";

// ── (a) baseline DIVERGE flipped to FAIL → RED ─────────────────────────────────
{
  const dir = mkFix("# base\n" + DIVERGE, "# work\nFAIL\tC\tsrc/a.lg::phone_home\t-\t-\tlaundering attempt\n");
  const r = lint(dir);
  if (r.code === 0) fails.push(`(a): a baseline DIVERGE flipped to FAIL was NOT caught (DIVERGE never transitions); output:\n${r.out}`);
  if (!/transition|DIVERGE/i.test(r.out)) fails.push(`(a): the failure did not mention the forbidden transition; output:\n${r.out}`);
}

// ── (b) baseline NOTIMPL jumped straight to QUARANTINE → RED ────────────────────
{
  const NOTIMPL = "NOTIMPL\tC\tsrc/a.lg::stub\t-\t-\tnot yet\n";
  const dir = mkFix("# base\n" + NOTIMPL, "# work\nQUARANTINE(expires=2027-01-01)\tC\tsrc/a.lg::stub\t-\t-\tillegal jump\n");
  const r = lint(dir);
  if (r.code === 0) fails.push(`(b): a baseline NOTIMPL jumped to QUARANTINE was NOT caught (NOTIMPL→QUARANTINE forbidden); output:\n${r.out}`);
}

// ── (control) baseline NOTIMPL → FAIL is ALLOWED → PASSES ───────────────────────
{
  const NOTIMPL = "NOTIMPL\tC\tsrc/a.lg::stub\t-\t-\tnot yet\n";
  const dir = mkFix("# base\n" + NOTIMPL, "# work\nFAIL\tC\tsrc/a.lg::stub\t-\t-\tnow a frontier\n");
  const r = lint(dir);
  if (r.code !== 0) fails.push(`(control): a LEGAL NOTIMPL→FAIL transition was wrongly rejected; output:\n${r.out}`);
}

if (fails.length) {
  for (const f of fails) console.error("FAIL finding4-transition: " + f);
  process.exit(1);
}
console.log("PASS finding4-transition");
