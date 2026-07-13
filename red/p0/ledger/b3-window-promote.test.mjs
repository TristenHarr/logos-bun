// W1.1 RED b3 (blast B3): the run-store promotion scans a RECENT WINDOW, not whole history. A
// key promotes iff its LAST 5 run records are all `pass` across ≥2 distinct timestamps; an
// ancient `fail` BEFORE that clean window must NOT block. The OLD whole-history rule ("any fail
// ever → refuse") made every FAIL-frontier candidate un-promotable once record-run.mjs (W1.2)
// logged a single dev fail. This fixture's store is [fail, then 5 clean passes across 2 ts]:
// promote MUST accept it and write PASS. A CONTROL confirms the window is real — the same store
// with the fail INSIDE the last-5 window (6th pass removed) is REFUSED — so "accepted" can't be
// a tool that ignores fails entirely.
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const PROMOTE = join(ROOT, "scripts", "promote.mjs");
const LINT = join(ROOT, "scripts", "lints", "ledger-lint.mjs");
const FIX = join(HERE, "b3-window-promote");
const KEY = "src/toy.lg::windowed";
const fails = [];

const SHA = "abc1230000000000000000000000000000000000";
const promote = (dir) => {
  try {
    const out = execFileSync("node", [PROMOTE, "--ledger", join(dir, "ledger.tsv"), "--key", KEY], {
      encoding: "utf8", env: { ...process.env, LEDGER_TODAY: "2026-07-13", LEDGER_HEAD_SHA: SHA },
    });
    return { code: 0, out };
  } catch (e) { return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") }; }
};
const passRow = (ledger) => new RegExp("^PASS\\tC\\t" + KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\t[0-9a-f]{40}\\t13\\t", "m").test(ledger);

// re-seal a run store body against GENESIS so a rewritten control store stays lint-valid.
const { chainDigest, GENESIS } = await import(LINT);
const reseal = (bodyLines) => {
  const body = bodyLines.join("\n") + "\n";
  return body + "#CHAIN " + chainDigest(GENESIS, body) + "\n";
};

// (a) ancient fail + a clean window of 5 across 2 ts → MUST promote.
{
  const work = mkdtempSync(join(tmpdir(), "b3ok-"));
  cpSync(FIX, work, { recursive: true });
  const r = promote(work);
  if (r.code !== 0) fails.push(`promote refused an ancient-fail-then-clean-window candidate (B3 window scan must ignore pre-window fails); output:\n${r.out}`);
  const ledger = readFileSync(join(work, "ledger.tsv"), "utf8");
  if (!passRow(ledger)) fails.push(`promote did not write PASS for the windowed candidate; ledger:\n${ledger}`);
}

// (b) CONTROL: shrink the window so the fail lands INSIDE the last 5 → MUST refuse. This proves
// the acceptance above is a genuine window scan, not a tool that ignores fails outright.
{
  const work = mkdtempSync(join(tmpdir(), "b3ctl-"));
  cpSync(FIX, work, { recursive: true });
  const runsPath = join(work, "runs", "ledger.runs.tsv");
  // drop the last pass row so the trailing 5 = [fail, pass, pass, pass, pass].
  const lines = readFileSync(runsPath, "utf8").split("\n").filter((l) => l && !l.startsWith("#CHAIN"));
  writeFileSync(runsPath, reseal(lines.slice(0, lines.length - 1)));
  const r = promote(work);
  if (r.code === 0) fails.push(`promote accepted a candidate whose last-5 window CONTAINS a fail (window scan is not enforced); output:\n${r.out}`);
  if (!/REFUSE/i.test(r.out)) fails.push(`promote did not emit REFUSE for the fail-in-window control; output:\n${r.out}`);
}

if (fails.length) {
  for (const f of fails) console.error("FAIL b3-window-promote: " + f);
  process.exit(1);
}
console.log("PASS b3-window-promote");
