// W1.1 RED (review-2 MAJOR-D / blast m1): the gate SCRUBS the fixture env seams before any
// production lint. A stray LEDGER_TODAY=2000-01-01 in the ambient environment must NOT un-expire
// an expired QUARANTINE when the gate runs — otherwise a wall-clock rollback silently unblocks
// every quarantine. gate.sh `unset`s LEDGER_TODAY/LEDGER_VERDICTS/LEDGER_HEAD_SHA before it lints,
// so the real UTC clock (today ≫ the expiry) governs and the gate goes RED.
// A CONTROL (a LIVE quarantine far in the future) stays GREEN, proving the RED is the expiry, not
// a broken seam.
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
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
const mkDir = (body) => {
  const dir = mkdtempSync(join(tmpdir(), "escrub-"));
  writeFileSync(join(dir, "q.tsv"), seal(body));
  return dir;
};
// run gate.sh --quick with the ledger checks pointed at `dir`, and a HOSTILE ambient LEDGER_TODAY.
const runGate = (dir) => {
  try {
    const out = execFileSync("bash", [GATE, "--quick"],
      { encoding: "utf8", env: { ...process.env, LEDGER_GATE_DIR: dir, LEDGER_TODAY: "2000-01-01" } });
    return { code: 0, out };
  } catch (e) { return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") }; }
};

// an EXPIRED quarantine (expires long before the real today of 2026-07-13).
const expired = mkDir("# expired q\nQUARANTINE(expires=2020-01-01)\tC\tsrc/x.lg::flaky\t-\t-\tlong dead\n");
const re = runGate(expired);
// gate must red specifically on L1/L2/L3 (the expiry lint), not stay green via the stray clock.
if (!/GATE FAIL \[L[123]/.test(re.out) && !/expir/i.test(re.out))
  fails.push(`env-scrub: a stray LEDGER_TODAY=2000-01-01 un-expired an expired QUARANTINE under the gate (the seam leaked into production); output:\n${re.out}`);
rmSync(expired, { recursive: true, force: true });

// CONTROL: a live quarantine (far future) must NOT red L1/L2/L3.
const live = mkDir("# live q\nQUARANTINE(expires=2099-01-01)\tC\tsrc/x.lg::flaky\t-\t-\tstill live\n");
const rl = runGate(live);
if (/GATE FAIL \[L[123]/.test(rl.out))
  fails.push(`env-scrub control: a LIVE far-future quarantine red-flagged L1/L2/L3 (the scrub/check is broken); output:\n${rl.out}`);
rmSync(live, { recursive: true, force: true });

if (fails.length) {
  for (const f of fails) console.error("FAIL envscrub-gate: " + f);
  process.exit(1);
}
console.log("PASS envscrub-gate");
