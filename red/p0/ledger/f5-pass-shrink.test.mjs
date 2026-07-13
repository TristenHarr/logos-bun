// W1.1 RED f5: dropping a PASS key that exists in the baseline, without an incident +
// per-key .ratchet-break marker, must fail ledger-lint (§5, L2 monotonicity). The baseline
// is injected hermetically via the fixture-local `ledger.tsv.head` snapshot (§4 step 1) so
// the test does not depend on the real repo HEAD. A control run PROVES the drop is legal
// once the incident + marker are present (so the failure is specifically the missing ceremony).
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { mkdtempSync, cpSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const LINT = join(ROOT, "scripts", "lints", "ledger-lint.mjs");
const FIX = join(HERE, "f5-pass-shrink");
const fails = [];

const lint = (dir) => {
  try {
    const out = execFileSync("node", [LINT, join(dir, "ledger.tsv")], {
      encoding: "utf8", env: { ...process.env, LEDGER_TODAY: "2026-07-13" },
    });
    return { code: 0, out };
  } catch (e) { return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") }; }
};

// (a) shrink WITHOUT ceremony → must FAIL.
const bare = mkdtempSync(join(tmpdir(), "f5a-"));
cpSync(FIX, bare, { recursive: true });
const r1 = lint(bare);
if (r1.code === 0) fails.push(`lint passed a PASS-set shrink vs baseline with no incident/marker (want nonzero); output:\n${r1.out}`);
if (!/monoton|shrink|PASS/i.test(r1.out)) fails.push(`lint failure did not mention the monotonicity/PASS shrink; output:\n${r1.out}`);

// (b) same shrink WITH incident + per-key marker naming the dropped key → must PASS.
// This isolates the failure to the MISSING CEREMONY, not the drop itself.
const ok = mkdtempSync(join(tmpdir(), "f5b-"));
cpSync(FIX, ok, { recursive: true });
mkdirSync(join(ok, "conformance", "ledger"), { recursive: true });
mkdirSync(join(ok, "conformance", "incidents"), { recursive: true });
writeFileSync(join(ok, "conformance", "ledger", ".ratchet-break"), "src/toy.lg::dropped\n");
writeFileSync(join(ok, "conformance", "incidents", "2026-07-13-drop.md"),
  "# incident\nkey: src/toy.lg::dropped\nledger: ledger.tsv\ntransition: PASS→FAIL(frozen)\n## Resolution\n");
const r2 = lint(ok);
if (r2.code !== 0) fails.push(`lint rejected a properly-ceremonied PASS drop (incident+marker present); output:\n${r2.out}`);

if (fails.length) {
  for (const f of fails) console.error("FAIL f5-pass-shrink: " + f);
  process.exit(1);
}
console.log("PASS f5-pass-shrink");
