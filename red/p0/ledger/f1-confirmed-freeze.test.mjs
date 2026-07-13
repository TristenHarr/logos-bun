// W1.1 RED f1: a CONFIRMED PASS→FAIL must make ratchet.mjs exit nonzero and write
// the .merge-freeze marker + an incident skeleton (§7 confirmed path). The verdict
// injection (LEDGER_VERDICTS) forces fail,fail so the confirmatory re-run reproduces.
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, cpSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const RATCHET = join(ROOT, "scripts", "ratchet.mjs");
const FIX = join(HERE, "f1-confirmed-freeze");
const fails = [];

// Copy the fixture to a scratch dir so the mutating tool never dirties the committed fixture.
const work = mkdtempSync(join(tmpdir(), "f1-"));
cpSync(FIX, work, { recursive: true });

let exitCode = 0;
let stdout = "";
try {
  stdout = execFileSync("node", [RATCHET, "--ledger", join(work, "ledger.tsv")], {
    encoding: "utf8",
    env: { ...process.env, LEDGER_VERDICTS: join(work, "verdicts.tsv"), LEDGER_TODAY: "2026-07-13" },
  });
} catch (e) {
  exitCode = e.status ?? 1;
  stdout = (e.stdout || "") + (e.stderr || "");
}

if (exitCode === 0) fails.push(`ratchet exited 0 on a confirmed regression (want nonzero); output:\n${stdout}`);

const freeze = join(work, "conformance", "ledger", ".merge-freeze");
if (!existsSync(freeze)) fails.push("no .merge-freeze marker written on confirmed regression");

const incDir = join(work, "conformance", "incidents");
const incidents = existsSync(incDir) ? readdirSync(incDir).filter((f) => f.endsWith(".md")) : [];
if (incidents.length === 0) fails.push("no incident skeleton written on confirmed regression");
else {
  const body = readFileSync(join(incDir, incidents[0]), "utf8");
  if (!body.includes("src/toy.lg::always")) fails.push("incident does not name the offending key");
  if (!/PASS→FAIL/.test(body)) fails.push("incident does not record the PASS→FAIL(frozen) transition");
}

// The confirmed path must NOT auto-demote the PASS row (a human fixes/reverts under the incident).
const ledger = readFileSync(join(work, "ledger.tsv"), "utf8");
if (/QUARANTINE/.test(ledger)) fails.push("confirmed regression must not auto-demote to QUARANTINE (that is the unconfirmed path)");
if (!/^PASS\t/m.test(ledger)) fails.push("confirmed regression must leave the PASS row in place for human triage");

if (fails.length) {
  for (const f of fails) console.error("FAIL f1-confirmed-freeze: " + f);
  process.exit(1);
}
console.log("PASS f1-confirmed-freeze");
