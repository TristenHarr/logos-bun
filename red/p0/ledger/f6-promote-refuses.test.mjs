// W1.1 RED f6: promote.mjs must REFUSE a candidate with 4/5 passes, and a candidate with
// 5/5 passes that all share ONE timestamp (§6: 5/5 across ≥2 distinct timestamps required).
// Neither candidate may become PASS. A POSITIVE CONTROL (a real 5/5-across-2-ts candidate)
// PROVES promote CAN write a PASS, so a mere crash (missing tool) can never masquerade as a
// refusal: a refusal is only credited when the tool RAN, emitted "REFUSE", and the control
// was accepted in the same invocation shape.
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const PROMOTE = join(ROOT, "scripts", "promote.mjs");
const FIX = join(HERE, "f6-promote-refuses");
const fails = [];

const promote = (dir, key) => {
  try {
    const out = execFileSync("node", [PROMOTE, "--ledger", join(dir, "ledger.tsv"), "--key", key], {
      encoding: "utf8",
      // hermetic (no git in the temp dir): supply the first-green-commit via the LEDGER_HEAD_SHA
      // seam (SCHEMA §10). promote now REFUSES to write the all-zeros sentinel (m4), so the seam
      // is the fixture's real 40-hex source — the positive control still asserts a real PASS row.
      env: { ...process.env, LEDGER_TODAY: "2026-07-13", LEDGER_HEAD_SHA: "abc1230000000000000000000000000000000000" },
    });
    return { code: 0, out };
  } catch (e) { return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") }; }
};
const pasRow = (ledger, key) =>
  new RegExp("^PASS\\t\\S\\t" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\t", "m").test(ledger);

// Positive control FIRST: promote must ACCEPT a real 5/5-across-2-ts candidate and write PASS.
// If this fails to run/accept, the tool is broken and the refusals below prove nothing.
{
  const work = mkdtempSync(join(tmpdir(), "f6ok-"));
  cpSync(FIX, work, { recursive: true });
  const r = promote(work, "src/toy.lg::good");
  if (r.code !== 0) fails.push(`promote refused the valid 5/5-across-2-ts control (tool must run+accept); output:\n${r.out}`);
  const ledger = readFileSync(join(work, "ledger.tsv"), "utf8");
  if (!pasRow(ledger, "src/toy.lg::good")) fails.push(`promote did not write PASS for the valid control; ledger:\n${ledger}`);
  // The promoted row must carry a real first-green-commit + the agreed asserts=11.
  if (!/^PASS\tC\tsrc\/toy\.lg::good\t[0-9a-f]{40}\t11\t/m.test(ledger))
    fails.push(`promoted control row missing first-green-commit/asserts=11; ledger:\n${ledger}`);
}

// Refusals: the tool must RUN, print an explicit "REFUSE", exit nonzero, and write no PASS.
for (const key of ["src/toy.lg::four_of_five", "src/toy.lg::five_one_ts"]) {
  const work = mkdtempSync(join(tmpdir(), "f6-"));
  cpSync(FIX, work, { recursive: true });
  const r = promote(work, key);
  if (r.code === 0) fails.push(`promote accepted ${key} (want refusal — not 5/5-across-≥2-ts); output:\n${r.out}`);
  if (!/REFUSE/i.test(r.out)) fails.push(`promote did not emit an explicit REFUSE for ${key} (a crash is not a refusal); output:\n${r.out}`);
  if (pasRow(readFileSync(join(work, "ledger.tsv"), "utf8"), key))
    fails.push(`promote wrote a PASS row for the refused candidate ${key}`);
}

if (fails.length) {
  for (const f of fails) console.error("FAIL f6-promote-refuses: " + f);
  process.exit(1);
}
console.log("PASS f6-promote-refuses");
