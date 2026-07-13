// W1.1 RED f2: a single UNCONFIRMED flake (fail then pass on the confirmatory re-run)
// must auto-demote the PASS row to QUARANTINE(expires=+14d), write an incident + the
// per-key .ratchet-break marker, recompute the chain, and keep the repo OPEN (exit 0).
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, cpSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const RATCHET = join(ROOT, "scripts", "ratchet.mjs");
const LINT = join(ROOT, "scripts", "lints", "ledger-lint.mjs");
const FIX = join(HERE, "f2-unconfirmed-quarantine");
const fails = [];

const work = mkdtempSync(join(tmpdir(), "f2-"));
cpSync(FIX, work, { recursive: true });

let exitCode = 0, out = "";
try {
  out = execFileSync("node", [RATCHET, "--ledger", join(work, "ledger.tsv")], {
    encoding: "utf8",
    env: { ...process.env, LEDGER_VERDICTS: join(work, "verdicts.tsv"), LEDGER_TODAY: "2026-07-13" },
  });
} catch (e) {
  exitCode = e.status ?? 1; out = (e.stdout || "") + (e.stderr || "");
}

// Repo stays open on an unconfirmed flake.
if (exitCode !== 0) fails.push(`ratchet exited ${exitCode} on an unconfirmed flake (want 0 — repo stays open); output:\n${out}`);

const freeze = join(work, "conformance", "ledger", ".merge-freeze");
if (existsSync(freeze)) fails.push("unconfirmed flake must NOT write .merge-freeze");

// +14d from LEDGER_TODAY 2026-07-13 = 2026-07-27.
const ledger = readFileSync(join(work, "ledger.tsv"), "utf8");
if (!/^QUARANTINE\(expires=2026-07-27\)\tC\tsrc\/toy\.lg::flaky\t-\t-\t/m.test(ledger))
  fails.push(`row not demoted to QUARANTINE(expires=2026-07-27) with cleared PASS fields; ledger:\n${ledger}`);
if (/^PASS\t/m.test(ledger)) fails.push("the flaky PASS row must be gone (demoted), not still PASS");

const brk = join(work, "conformance", "ledger", ".ratchet-break");
if (!existsSync(brk)) fails.push("no .ratchet-break marker written for the sanctioned demotion");
else if (!readFileSync(brk, "utf8").includes("src/toy.lg::flaky"))
  fails.push(".ratchet-break marker does not list the demoted key (per-key scope, §9)");

const incDir = join(work, "conformance", "incidents");
const incidents = existsSync(incDir) ? readdirSync(incDir).filter((f) => f.endsWith(".md")) : [];
if (incidents.length === 0) fails.push("no incident written for the demotion");
else if (!readFileSync(join(incDir, incidents[0]), "utf8").includes("src/toy.lg::flaky"))
  fails.push("incident does not name the demoted key");

// After a sanctioned demotion the chain must still verify (ratchet rechained it),
// and monotonicity must accept it (marker + incident name the key).
let lintCode = 0, lintOut = "";
try {
  lintOut = execFileSync("node", [LINT, join(work, "ledger.tsv")], {
    encoding: "utf8",
    env: { ...process.env, LEDGER_TODAY: "2026-07-13" },
  });
} catch (e) { lintCode = e.status ?? 1; lintOut = (e.stdout || "") + (e.stderr || ""); }
if (lintCode !== 0) fails.push(`lint rejected the sanctioned post-demotion ledger:\n${lintOut}`);

if (fails.length) {
  for (const f of fails) console.error("FAIL f2-unconfirmed-quarantine: " + f);
  process.exit(1);
}
console.log("PASS f2-unconfirmed-quarantine");
