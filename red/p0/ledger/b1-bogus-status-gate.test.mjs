// W1.1 RED b1 (blast B1): the gate must fail on the ledger-lint's NONZERO EXIT CODE, not on a
// tag substring. A ledger with a BOGUS status token (but a VALID chain, so no "L1 chain"
// substring, and no L2/L3 tag either) makes ledger-lint exit 1. The OLD _ledger_gate credited
// `pass` unless the output substring-matched L1/L2/L3 → this whole class of lint failure was
// GREEN at the gate. This fixture drives gate.sh's ledger checks against a temp ledger dir
// (via the LEDGER_GATE_DIR seam, scoped to fixtures) and asserts the gate goes RED.
//
// A POSITIVE CONTROL (a clean, lint-valid ledger in the same dir shape) proves the gate can be
// GREEN, so a crash/env-error can never masquerade as the RED we require.
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { mkdtempSync, cpSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const GATE = join(ROOT, "scripts", "gate.sh");
const BOGUS = join(HERE, "b1-bogus-status-gate", "ledger.tsv");
const fails = [];

// Run gate.sh --quick with the ledger checks pointed at `dir` (LEDGER_GATE_DIR seam).
const runGate = (dir) => {
  try {
    const out = execFileSync("bash", [GATE, "--quick"], {
      encoding: "utf8",
      env: { ...process.env, LEDGER_GATE_DIR: dir, LEDGER_TODAY: "2026-07-13" },
    });
    return { code: 0, out };
  } catch (e) { return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") }; }
};

// (a) BOGUS-status ledger (valid chain) → gate MUST go RED.
const bad = mkdtempSync(join(tmpdir(), "b1bad-"));
cpSync(dirname(BOGUS), bad, { recursive: true });
const rb = runGate(bad);
if (rb.code === 0) fails.push(`gate stayed GREEN on a BOGUS-status ledger with a valid chain (nonzero lint exit must red the gate); output:\n${rb.out}`);
if (!/L1|GATE RED/i.test(rb.out)) fails.push(`gate output did not surface the ledger failure; output:\n${rb.out}`);
rmSync(bad, { recursive: true, force: true });

// (b) POSITIVE CONTROL: a clean lint-valid ledger in the same dir → the ledger gates pass.
const good = mkdtempSync(join(tmpdir(), "b1good-"));
mkdirSync(good, { recursive: true });
// body over GENESIS (no .head, not git) — a single legal FAIL row.
const goodBody = "# b1 clean control\nFAIL\tC\tsrc/toy.lg::y\t-\t-\tclean frontier row\n";
// compute chain via the shared core so the control is byte-exact.
const { chainDigest, GENESIS } = await import(join(ROOT, "scripts", "lints", "ledger-lint.mjs"));
writeFileSync(join(good, "ledger.tsv"), goodBody + "#CHAIN " + chainDigest(GENESIS, goodBody) + "\n");
const rg = runGate(good);
// the control ledger dir must not itself red the L1/L2/L3 checks.
if (/GATE FAIL \[L[123]\]/.test(rg.out)) fails.push(`gate red-flagged a clean control ledger on L1/L2/L3 (the seam or a check is broken); output:\n${rg.out}`);
rmSync(good, { recursive: true, force: true });

if (fails.length) {
  for (const f of fails) console.error("FAIL b1-bogus-status-gate: " + f);
  process.exit(1);
}
console.log("PASS b1-bogus-status-gate");
