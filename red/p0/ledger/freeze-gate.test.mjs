// W1.1 RED (blast B2 / SCHEMA §9): the freeze marker must actually BLOCK, and a committed
// marker must RED the gate.
//   (a) a `.merge-freeze` marker present in the working tree → gate.sh REFUSES with a clear
//       "repo frozen" message (a confirmed PASS regression blocks all further merges). Today the
//       marker was WRITTEN by ratchet.mjs but CONSUMED by nothing.
//   (b) a committed `.ratchet-break` at HEAD → ledger-lint exits 1 → gate RED (B1 surfaces the
//       §9 committed-marker ban that the old tag-substring sieve let sail through GREEN).
// A CONTROL (a clean ledger dir, no markers) stays GREEN on the freeze + L1/L2/L3 checks.
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const GATE = join(ROOT, "scripts", "gate.sh");
const LINT = join(ROOT, "scripts", "lints", "ledger-lint.mjs");
const { chainDigest, GENESIS } = await import(LINT);
const fails = [];

const seal = (body) => body + "#CHAIN " + chainDigest(GENESIS, body) + "\n";
const runGate = (dir) => {
  try {
    const out = execFileSync("bash", [GATE, "--quick"],
      { encoding: "utf8", env: { ...process.env, LEDGER_GATE_DIR: dir, LEDGER_TODAY: "2026-07-13" } });
    return { code: 0, out };
  } catch (e) { return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") }; }
};

// ── (a) .merge-freeze present → gate refuses "repo frozen" ─────────────────────
{
  const dir = mkdtempSync(join(tmpdir(), "frz-"));
  writeFileSync(join(dir, "p.tsv"), seal("# clean\nFAIL\tC\tsrc/x.lg::a\t-\t-\tfrontier\n"));
  writeFileSync(join(dir, ".merge-freeze"), "src/x.lg::a\n");
  const r = runGate(dir);
  if (r.code === 0) fails.push(`(a): the gate stayed GREEN with a .merge-freeze marker present (a frozen repo must block); output:\n${r.out}`);
  if (!/frozen|FREEZE/i.test(r.out)) fails.push(`(a): the gate did not surface a "repo frozen" refusal; output:\n${r.out}`);
  rmSync(dir, { recursive: true, force: true });
}

// ── (control) no markers → the freeze + L1/L2/L3 checks are GREEN ──────────────
{
  const dir = mkdtempSync(join(tmpdir(), "frzok-"));
  writeFileSync(join(dir, "p.tsv"), seal("# clean\nFAIL\tC\tsrc/x.lg::a\t-\t-\tfrontier\n"));
  const r = runGate(dir);
  if (/GATE FAIL \[FREEZE\]/.test(r.out)) fails.push(`(control): a marker-less dir tripped the freeze check; output:\n${r.out}`);
  if (/GATE FAIL \[L[123]/.test(r.out)) fails.push(`(control): a clean ledger dir red-flagged L1/L2/L3; output:\n${r.out}`);
  rmSync(dir, { recursive: true, force: true });
}

// ── (b) committed .ratchet-break at HEAD → ledger-lint exit 1 → gate RED ───────
{
  const dir = mkdtempSync(join(tmpdir(), "rbk-"));
  const git = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8", stdio: "pipe" });
  git("init", "-q");
  git("config", "user.email", "fixture@logos-bun.test");
  git("config", "user.name", "fixture");
  git("config", "commit.gpgsign", "false");
  mkdirSync(join(dir, "conformance", "ledger"), { recursive: true });
  const lp = join(dir, "conformance", "ledger", "p.tsv");
  writeFileSync(lp, seal("# clean\nFAIL\tC\tsrc/x.lg::a\t-\t-\tfrontier\n"));
  // commit the .ratchet-break marker (the §9 ban target).
  writeFileSync(join(dir, "conformance", "ledger", ".ratchet-break"), "src/x.lg::a\n");
  git("add", "-A", "-f"); git("commit", "-q", "-m", "seed + committed ratchet-break");
  let code = 0, out = "";
  try { out = execFileSync("node", [LINT, lp], { encoding: "utf8", env: { ...process.env, LEDGER_TODAY: "2026-07-13" } }); }
  catch (e) { code = e.status ?? 1; out = (e.stdout || "") + (e.stderr || ""); }
  if (code === 0) fails.push(`(b): a committed .ratchet-break at HEAD did not RED the lint (§9 committed-marker ban); output:\n${out}`);
  if (!/ratchet-break|markers/i.test(out)) fails.push(`(b): the failure did not mention the committed-marker ban; output:\n${out}`);
  rmSync(dir, { recursive: true, force: true });
}

if (fails.length) {
  for (const f of fails) console.error("FAIL freeze-gate: " + f);
  process.exit(1);
}
console.log("PASS freeze-gate");
