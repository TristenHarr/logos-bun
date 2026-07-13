#!/usr/bin/env node
// conformance/drift-canary.mjs — the NON-BLOCKING drift lane (BAKE_A_BUN §6.3; card W2.3).
//
// WHAT IT IS. A canary that shows where upstream bun is moving BEFORE a pin bump, so a
// re-baseline (SPEC_PIN.md ritual) is a planned absorption and never a surprise. It compares:
//
//   • baseline  — the test-file set AT SPEC_PIN (glob `test/**/*.test.{ts,tsx,js,jsx,mjs,cjs,mts}`
//                 under vendor/bun, exactly the SPEC_PIN "counted mechanically at the tag" set),
//   • upstream  — a "newer upstream HEAD" test-file set. §6.3 wants live upstream HEAD; this env
//                 cannot fetch, so we drive against a MANIFEST fixture (a checked-in file list)
//                 that stands in for that fetch. When live fetch lands, only the source of this
//                 list changes — the drift math below is identical.
//   • ledger    — the `test/…` paths any conformance/ledger/*.tsv already references (coverage).
//
// and reports DRIFT = (upstream ∖ baseline) ∖ ledger-covered — the test files upstream added
// since the pin that NO ledger row covers yet — into conformance/ledger/drift.tsv.
//
// WHY IT NEVER GATES. drift.tsv is a SEPARATE artifact with a DISTINCT row shape (`DRIFT ⇥ path
// ⇥ note`, never a ledger `STATUS ⇥ LANE ⇥ …` row), so no ledger lint ever mistakes it for a
// ratchet ledger. `--check` prints the drift count and ALWAYS exits 0 — a drift row is
// informational, and the gate wires it as a PRINT-ONLY note (scripts/gate.sh), never a red.
// The one thing that CAN exit nonzero is a MALFORMED invocation (a missing manifest, an
// unreadable ledger) — an operator error, distinct from "drift exists".
//
// USAGE
//   drift-canary.mjs --check [--baseline-manifest F | --vendor-dir D] --upstream-manifest F \
//                    [--ledger F ...] [--ledger-dir D]
//       print the drift count (+ the drifting files); exit 0 regardless of drift.
//   drift-canary.mjs --write [same inputs] [--out conformance/ledger/drift.tsv]
//       (re)generate drift.tsv from the current inputs; exit 0 regardless of drift.
//
// Baseline source: --baseline-manifest (a hermetic file list, used by the RED battery) OR
// --vendor-dir (walk a real vendor/bun tree with the SPEC_PIN glob). Default in production is
// --vendor-dir vendor/bun; the fixtures pin a manifest so drift detection is deterministic +
// offline. If neither is given, baseline is empty (every upstream file would then look new).

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

// the SPEC_PIN glob, as a single regex over a file's basename.
const TEST_FILE = /\.test\.(?:ts|tsx|js|jsx|mjs|cjs|mts)$/;

// ── pure core (exported, unit-tested by red/p0/drift) ─────────────────────────────

// DRIFT = (upstream ∖ baseline) ∖ ledger-covered, sorted + de-duped, deterministic.
// A pre-pin file (already in baseline) is NEVER drift even if uncovered — that's the FAIL
// frontier, a different concept. Drift is strictly about files upstream ADDED since the pin.
export function computeDrift({ baseline = [], upstream = [], ledgerPaths = [] }) {
  const base = new Set(baseline);
  const covered = new Set(ledgerPaths);
  const out = new Set();
  for (const f of upstream) {
    if (base.has(f)) continue;      // existed at the pin → not new
    if (covered.has(f)) continue;   // ledger already triaged it → not drift
    out.add(f);
  }
  return [...out].sort();
}

// drift.tsv text. Row shape is DELIBERATELY unlike a ledger row (leads with the literal token
// `DRIFT`, three fields, no LANE/status/chain) so it can never be linted as a ratchet ledger.
// A header documents the non-gating contract inline. An empty drift set → header only.
export function renderDriftTsv(driftPaths, { generatedNote = "upstream-new, ledger-uncovered" } = {}) {
  const header = [
    "# conformance/ledger/drift.tsv — the NON-BLOCKING drift lane (BAKE_A_BUN §6.3; W2.3).",
    "# INFORMATIONAL ONLY — this file NEVER gates a merge. It lists test files a 'newer upstream'",
    "# added since SPEC_PIN that no conformance/ledger/*.tsv row covers yet; it is the worklist the",
    "# re-baseline ritual's frontier-scan (SPEC_PIN.md step 4) consumes so a pin bump is a planned",
    "# absorption. Regenerate with `node conformance/drift-canary.mjs --write`. Row: DRIFT ⇥ path ⇥ note.",
  ].join("\n");
  const rows = [...driftPaths].sort().map((p) => `DRIFT\t${p}\t${generatedNote}`);
  return header + "\n" + (rows.length ? rows.join("\n") + "\n" : "");
}

// ── input readers ─────────────────────────────────────────────────────────────────

// a manifest = one relpath per line; `#`-comments and blanks ignored.
function readManifest(file) {
  return readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length && !l.startsWith("#"));
}

// walk a real vendor/bun tree; return test-file paths relative to that tree's parent so they read
// like `test/…` (matching how the ledger names them). We root the walk at <dir>/test.
function walkVendorTests(vendorDir) {
  const out = [];
  const testRoot = join(vendorDir, "test");
  if (!existsSync(testRoot) || !statSync(testRoot).isDirectory()) return out;
  const rec = (d) => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, ent.name);
      if (ent.isDirectory()) rec(p);
      else if (TEST_FILE.test(ent.name)) out.push(relative(vendorDir, p));
    }
  };
  rec(testRoot);
  return out.sort();
}

// pull every `test/…` path (field 3, minus any `::name`) out of one ledger tsv.
function ledgerPathsOf(file) {
  const paths = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const f = line.split("\t");
    if (f.length < 3) continue;
    const p = f[2].split("::")[0].trim();
    if (p.startsWith("test/")) paths.push(p);
  }
  return paths;
}

function collectLedgerPaths({ ledgers = [], ledgerDir }) {
  const files = [...ledgers];
  if (ledgerDir && existsSync(ledgerDir)) {
    for (const name of readdirSync(ledgerDir)) {
      // drift.tsv is not a ledger — never fold it back into coverage (it would suppress itself).
      if (name.endsWith(".tsv") && name !== "drift.tsv") files.push(join(ledgerDir, name));
    }
  }
  const out = [];
  for (const f of files) if (existsSync(f)) out.push(...ledgerPathsOf(f));
  return out;
}

// ── CLI ─────────────────────────────────────────────────────────────────────────

function resolveInputs(o) {
  const baseline = o["baseline-manifest"]
    ? readManifest(o["baseline-manifest"])
    : o["vendor-dir"]
      ? walkVendorTests(o["vendor-dir"])
      : [];
  if (!o["upstream-manifest"]) {
    console.error("drift-canary: --upstream-manifest is required (the 'newer upstream' file list stands in for a live fetch)");
    process.exit(2);
  }
  const upstream = readManifest(o["upstream-manifest"]);
  const ledgerPaths = collectLedgerPaths({
    ledgers: o.ledger ?? [],
    ledgerDir: o["ledger-dir"],
  });
  return { baseline, upstream, ledgerPaths };
}

function main() {
  const { values: o } = parseArgs({
    options: {
      check: { type: "boolean", default: false },
      write: { type: "boolean", default: false },
      ["baseline-manifest"]: { type: "string" },
      ["vendor-dir"]: { type: "string" },
      ["upstream-manifest"]: { type: "string" },
      ledger: { type: "string", multiple: true },
      ["ledger-dir"]: { type: "string" },
      out: { type: "string" },
    },
  });

  const { baseline, upstream, ledgerPaths } = resolveInputs(o);
  const drift = computeDrift({ baseline, upstream, ledgerPaths });

  if (o.write) {
    const out = o.out ?? join(ROOT, "conformance", "ledger", "drift.tsv");
    writeFileSync(out, renderDriftTsv(drift));
    console.log(`drift-canary: wrote ${drift.length} drift row(s) to ${out}`);
    // NON-GATING: writing drift never fails the process.
    process.exit(0);
  }

  // --check (default): print the count + the drifting files, ALWAYS exit 0 (§6.3 non-gating).
  console.log(`drift-canary: drift=${drift.length} (upstream-new test files not covered by any ledger)`);
  for (const f of drift) console.log(`  DRIFT ${f}`);
  if (drift.length === 0) console.log("  (none — upstream frontier fully triaged)");
  process.exit(0);
}

// only run the CLI when invoked directly (imports get the pure core, no side effects).
if (process.argv[1] && (process.argv[1] === fileURLToPath(import.meta.url))) main();
