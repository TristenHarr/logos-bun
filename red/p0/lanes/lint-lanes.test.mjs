// W1.3 RED: conformance/lint-lanes.mjs — the Lane-A validity lint (L4).
//   A Lane-A pass counts only if the assertions observe the CHILD. A test file exercising an
//   in-process API (Bun.build( / Bun.serve( / bun:ffi / Bun.Transpiler / Bun.plugin / direct
//   import of a bun-internal module) is auto-marked BLOCKED(P9); a Lane-A PASS row for such a
//   file is a lint FAILURE. Clean (spawn-only) files pass through untouched.
//
// The lint emits SCHEMA-conformant rows (conformance/ledger/SCHEMA.md — 6 TAB fields):
//   STATUS ⇥ LANE ⇥ path ⇥ - ⇥ - ⇥ note   (BLOCKED(P9) rows carry `-` in fields 4 & 5).
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

const LINT = join(ROOT, "conformance", "lint-lanes.mjs");
const FIX = join(ROOT, "red", "p0", "lanes", "fixtures", "lint");

check(existsSync(LINT), "conformance/lint-lanes.mjs missing");

// Each flagged fixture → exactly one BLOCKED(P9) row; each clean fixture → no BLOCKED row.
const FLAGGED = [
  "inproc-build.test.ts",     // Bun.build(
  "inproc-serve.test.ts",     // Bun.serve(
  "ffi-inproc.test.ts",       // bun:ffi
  "transpiler-inproc.test.ts",// Bun.Transpiler / new Transpiler
  "plugin-inproc.test.ts",    // Bun.plugin
  "internal-import.test.ts",  // import of bun:internal-*
];
const CLEAN = ["spawn-only.test.ts", "spawn-run.test.ts"];

// A SCHEMA-conformant BLOCKED(P9) row: 6 TAB fields, status BLOCKED(P9), lane A,
// fields 4 & 5 are `-`.
const BLOCKED_ROW = /^BLOCKED\(P9\)\tA\t[^\t\n]+\t-\t-\t[^\t\n]*$/;

// ── report mode: run the lint over ALL fixtures, parse its stdout rows ──
if (fails.length === 0) {
  const args = [...FLAGGED, ...CLEAN].map((f) => join(FIX, f));
  const res = spawnSync("node", [LINT, "--report", ...args], { encoding: "utf8" });
  const rows = res.stdout.trim().split(/\r?\n/).filter(Boolean);

  for (const f of FLAGGED) {
    const row = rows.find((r) => r.split("\t")[2]?.endsWith(f));
    check(!!row, `no lint row for flagged fixture ${f}`);
    if (row) {
      check(BLOCKED_ROW.test(row), `flagged fixture ${f} row not a SCHEMA BLOCKED(P9) row: ${JSON.stringify(row)}`);
    }
  }
  for (const f of CLEAN) {
    const row = rows.find((r) => r.split("\t")[2]?.endsWith(f));
    // clean files are either absent from the report or NOT BLOCKED
    if (row) check(!/^BLOCKED/.test(row), `clean fixture ${f} was wrongly flagged: ${JSON.stringify(row)}`);
  }
}

// ── gate mode: a Lane-A PASS asserted for a flagged file is a lint FAILURE (nonzero) ──
if (fails.length === 0) {
  // A synthetic ledger row: PASS, lane A, for a flagged fixture → the lint must reject it.
  const badRow = `PASS\tA\t${join(FIX, "inproc-build.test.ts")}\t${"a".repeat(40)}\t3\tclaimed Lane-A green`;
  const bad = spawnSync("node", [LINT, "--gate"], { encoding: "utf8", input: badRow + "\n" });
  check(bad.status !== 0, "lint accepted a Lane-A PASS for a Bun.build( file (L4 dead)");
  check(/BLOCKED\(P9\)|Bun\.build|in-process/i.test(bad.stdout + bad.stderr),
        "lint rejection did not explain WHY the flagged file cannot be Lane-A PASS");

  // A Lane-A PASS for a clean spawn-only file → accepted (exit 0).
  const goodRow = `PASS\tA\t${join(FIX, "spawn-only.test.ts")}\t${"b".repeat(40)}\t2\tobserves the child`;
  const good = spawnSync("node", [LINT, "--gate"], { encoding: "utf8", input: goodRow + "\n" });
  check(good.status === 0, `lint wrongly rejected a clean Lane-A PASS:\n${good.stdout}\n${good.stderr}`);

  // A BLOCKED(P9) row for a flagged file (the correct classification) → accepted.
  const okBlocked = `BLOCKED(P9)\tA\t${join(FIX, "inproc-build.test.ts")}\t-\t-\tin-process Bun.build`;
  const okB = spawnSync("node", [LINT, "--gate"], { encoding: "utf8", input: okBlocked + "\n" });
  check(okB.status === 0, `lint wrongly rejected a correct BLOCKED(P9) row:\n${okB.stdout}\n${okB.stderr}`);
}

if (fails.length) {
  for (const f of fails) console.error("FAIL lint-lanes: " + f);
  process.exit(1);
}
console.log("PASS lint-lanes");
