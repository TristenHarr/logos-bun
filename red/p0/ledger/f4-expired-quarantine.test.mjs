// W1.1 RED f4: an expired QUARANTINE (expires < LEDGER_TODAY) must fail ledger-lint (§3,
// L3 expiry enforcement). LEDGER_TODAY=2026-07-13 makes the fixture's expires=2026-07-01
// stale. A boundary check (expires==today is still LIVE) guards against an off-by-one.
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const LINT = join(ROOT, "scripts", "lints", "ledger-lint.mjs");
const LEDGER = join(HERE, "f4-expired-quarantine", "ledger.tsv");
const fails = [];

const run = (today) => {
  try {
    const out = execFileSync("node", [LINT, LEDGER], {
      encoding: "utf8", env: { ...process.env, LEDGER_TODAY: today },
    });
    return { code: 0, out };
  } catch (e) { return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") }; }
};

// expires=2026-07-01 < today 2026-07-13 → expired → FAIL.
const expired = run("2026-07-13");
if (expired.code === 0) fails.push(`lint passed an expired QUARANTINE (want nonzero); output:\n${expired.out}`);
if (!/expir/i.test(expired.out)) fails.push(`lint failure did not mention expiry; output:\n${expired.out}`);

// Boundary: expires==today is still LIVE (must NOT fail on that basis).
const boundary = run("2026-07-01");
if (boundary.code !== 0 && !/chain|schema|monoton/i.test(boundary.out))
  fails.push(`lint wrongly failed a QUARANTINE whose expiry == today (boundary is live); output:\n${boundary.out}`);

if (fails.length) {
  for (const f of fails) console.error("FAIL f4-expired-quarantine: " + f);
  process.exit(1);
}
console.log("PASS f4-expired-quarantine");
