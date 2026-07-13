// W2.3 RED — conformance/drift-canary.mjs. The NON-BLOCKING drift lane (BAKE_A_BUN §6.3):
// compares the test-file set at SPEC_PIN (baseline) against a "newer upstream" set (a fixture,
// since a live upstream fetch is unavailable in this env) and reports which upstream-new test
// files the ledger does not cover yet → conformance/ledger/drift.tsv. This battery IS the spec.
//
//   drift = (upstream ∖ baseline) ∖ ledger-covered
//         = test files upstream added since the pin that no ledger row references.
//
// The canary NEVER gates a merge (§6.3): a drift row is informational. --check prints a count
// and exits 0 even when drift > 0 (the assertion below is the load-bearing non-gating lock).
//
// It also asserts the SPEC_PIN.md re-baseline ritual is COMPLETE — every step §6.3 names must be
// present (bump pin → re-apply patch series loud-on-fail → frontier-scan new files → triage →
// refetch+sha the oracle → incident record).
//
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const CANARY = join(ROOT, "conformance", "drift-canary.mjs");
const FIX = join(HERE, "fixtures");
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

// ── import the canary's pure core (RED if the module doesn't exist yet) ───────────
let computeDrift, renderDriftTsv;
try {
  ({ computeDrift, renderDriftTsv } = await import(pathToFileURL(CANARY).href));
} catch (e) {
  console.error("FAIL drift-canary: cannot import conformance/drift-canary.mjs (does not exist yet?):\n" + (e.stack || e));
  process.exit(1);
}
ok(typeof computeDrift === "function", "drift-canary.mjs must export computeDrift({ baseline, upstream, ledgerPaths }) → sorted string[]");
ok(typeof renderDriftTsv === "function", "drift-canary.mjs must export renderDriftTsv(driftPaths) → drift.tsv text");

// ── 1. pure core: exactly the 2 upstream-new, ledger-uncovered files drift ────────
if (typeof computeDrift === "function") {
  const drift = computeDrift({
    baseline: ["test/a.test.ts", "test/b.test.ts"],
    upstream: ["test/a.test.ts", "test/b.test.ts", "test/foo.test.ts", "test/bar.test.ts"],
    ledgerPaths: ["test/a.test.ts", "test/b.test.ts"],
  });
  ok(Array.isArray(drift), "computeDrift must return an array");
  ok(JSON.stringify(drift) === JSON.stringify(["test/bar.test.ts", "test/foo.test.ts"]),
     `computeDrift must return exactly the 2 upstream-new uncovered files, SORTED; got ${JSON.stringify(drift)}`);

  // ledger coverage suppresses an upstream-new file → zero drift.
  const covered = computeDrift({
    baseline: ["test/a.test.ts"],
    upstream: ["test/a.test.ts", "test/baz.test.ts"],
    ledgerPaths: ["test/a.test.ts", "test/baz.test.ts"],
  });
  ok(JSON.stringify(covered) === "[]", `a covered upstream-new file must not drift; got ${JSON.stringify(covered)}`);

  // a file already at baseline is NOT drift even if the ledger never mentions it (drift is about
  // NEW upstream files, not existing coverage gaps — those are the FAIL frontier, not drift).
  const preexisting = computeDrift({
    baseline: ["test/a.test.ts", "test/old.test.ts"],
    upstream: ["test/a.test.ts", "test/old.test.ts"],
    ledgerPaths: ["test/a.test.ts"],
  });
  ok(JSON.stringify(preexisting) === "[]", `a pre-pin file must never count as drift; got ${JSON.stringify(preexisting)}`);

  // determinism: unsorted / duplicated inputs yield the same sorted, de-duped result.
  const shuffled = computeDrift({
    baseline: ["test/b.test.ts", "test/a.test.ts"],
    upstream: ["test/foo.test.ts", "test/bar.test.ts", "test/foo.test.ts", "test/b.test.ts", "test/a.test.ts"],
    ledgerPaths: [],
  });
  ok(JSON.stringify(shuffled) === JSON.stringify(["test/bar.test.ts", "test/foo.test.ts"]),
     `computeDrift must be deterministic (sorted + de-duped) regardless of input order; got ${JSON.stringify(shuffled)}`);
}

// ── 2. drift.tsv render format: a distinct, self-describing, non-ledger shape ──────
if (typeof renderDriftTsv === "function") {
  const tsv = renderDriftTsv(["test/bar.test.ts", "test/foo.test.ts"]);
  ok(typeof tsv === "string", "renderDriftTsv must return a string");
  const lines = tsv.split("\n").filter((l) => l.length);
  const dataRows = lines.filter((l) => !l.startsWith("#"));
  ok(dataRows.length === 2, `drift.tsv must carry one row per drift file (2); got ${dataRows.length}`);
  for (const r of dataRows) {
    const f = r.split("\t");
    // DRIFT ⇥ path ⇥ note — a shape DISTINCT from the ledger's 6-field STATUS row, so no lint
    // ever mistakes drift.tsv for a ratchet ledger (it must never gate).
    ok(f[0] === "DRIFT", `drift row must lead with the DRIFT token (never a ledger STATUS); got ${JSON.stringify(f)}`);
    ok(/\.test\.[a-z]+$/.test(f[1]), `drift row field 2 must be the upstream test path; got ${JSON.stringify(f)}`);
  }
  ok(dataRows.some((r) => r.startsWith("DRIFT\ttest/foo.test.ts\t")), "drift.tsv missing DRIFT row for foo.test.ts");
  ok(dataRows.some((r) => r.startsWith("DRIFT\ttest/bar.test.ts\t")), "drift.tsv missing DRIFT row for bar.test.ts");
  // an empty drift set renders a header-only file (no data rows) — the honest "no drift" state.
  const empty = renderDriftTsv([]);
  ok(empty.split("\n").filter((l) => l.length && !l.startsWith("#")).length === 0,
     "renderDriftTsv([]) must produce zero data rows (the no-drift state)");
}

// ── 3. --check CLI over the drift2 fixture: prints a count, NEVER reds (exit 0) ────
function runCheck(fixDir) {
  const args = [CANARY, "--check",
    "--baseline-manifest", join(fixDir, "baseline.manifest"),
    "--upstream-manifest", join(fixDir, "upstream.manifest"),
    "--ledger", join(fixDir, "ledger.tsv")];
  try {
    const out = execFileSync("node", args, { encoding: "utf8" });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") };
  }
}

const two = runCheck(join(FIX, "drift2"));
ok(two.code === 0, `--check MUST exit 0 even with drift present (non-gating lane, §6.3); got exit ${two.code}:\n${two.out}`);
ok(/drift[:=]?\s*2\b/i.test(two.out), `--check must report a drift count of 2; got:\n${two.out}`);
ok(/foo\.test\.ts/.test(two.out) && /bar\.test\.ts/.test(two.out),
   `--check must name the 2 drifting files; got:\n${two.out}`);

const zero = runCheck(join(FIX, "covered"));
ok(zero.code === 0, `--check MUST exit 0 on zero drift; got exit ${zero.code}:\n${zero.out}`);
ok(/drift[:=]?\s*0\b/i.test(zero.out), `--check must report a drift count of 0 when all covered; got:\n${zero.out}`);

// ── 4. SPEC_PIN.md re-baseline ritual completeness (§6.3) ─────────────────────────
// Every step §6.3 names must be present: bump the pin, re-apply the patch series with a LOUD
// failure, frontier-scan the newly-added files, triage them into phases, refetch+sha the oracle
// binary, and record an incident. A missing step is a silent re-baseline footgun.
if (existsSync(join(ROOT, "SPEC_PIN.md"))) {
  const pin = readFileSync(join(ROOT, "SPEC_PIN.md"), "utf8");
  ok(/re-baseline ritual/i.test(pin), "SPEC_PIN.md must document the re-baseline ritual");
  for (const [label, re] of [
    ["bump pin / update fields", /(bump|update).*(pin|tag|field)/i],
    ["bump vendor/bun submodule", /submodule/i],
    ["re-apply patch series LOUD-on-fail", /(re-?apply|apply).*(patch)[\s\S]{0,80}(loud|fail|stop)/i],
    ["frontier-scan new files", /frontier-scan/i],
    ["triage into phases", /triage/i],
    ["refetch + sha the oracle binary", /(fetch|refetch|sha).*(oracle|binary)/i],
    ["record an incident", /incident/i],
  ]) {
    ok(re.test(pin), `SPEC_PIN.md re-baseline ritual is missing the step: "${label}"`);
  }
}

if (fails.length) {
  for (const f of fails) console.error("FAIL drift-canary: " + f);
  process.exit(1);
}
console.log("PASS drift-canary");
