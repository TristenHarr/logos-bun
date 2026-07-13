#!/usr/bin/env node
// scripts/mutation.mjs — the mutation-score ratchet (§8: eat our own dog food; W2.5 / P0.11).
//
// A harness that can't catch mutants can't catch regressions. Stryker mutates the node harness
// surface (the comparators, lints, runner, fuzz-driver, bench/lib) and reports how many injected
// mutants the red/p0 suite KILLS. That number is a tracked metric with a floor that only rises.
//
// TWO MODES, split for cost:
//
//   --check   CHEAP. The gate (gate.sh L14) runs this on every pre-commit. It reads the LAST
//             RECORDED score from conformance/mutation-floor.json and verifies every target's
//             killed/total meets its per-target floor. It NEVER runs Stryker (a full pass is
//             minutes). Exit 0 = every target at/above floor (or no score yet: empty-guard).
//             Exit 1 = a floor breach, a malformed score, or a floor LOWERED below its committed
//             HEAD value (the ratchet only rises). Fail-loud: a file that can't be parsed is a
//             fail, never a silent pass (CLAUDE.md R1).
//
//   --run [target]   SLOW. Runs the actual Stryker pass over one target (or all), reads Stryker's
//             mutation report, and REWRITES conformance/mutation-floor.json with the fresh
//             killed/total — RAISING the floor to the newly proven score when it improves, never
//             lowering it. This is the only writer of the score numbers. Runs at loop boundaries
//             (R8 build discipline), never inside the gate.
//
// Score file schema (conformance/mutation-floor.json):
//   { "$schema": "mutation-floor/v1",
//     "targets": { "<id>": { "path": "<mutated file(s)>", "killed": N, "total": M, "floor": R } } }
//   invariant: 0 <= killed <= total, total > 0, 0 <= floor <= 1, killed/total >= floor.
//   `floor` is the ratchet minimum (a ratio); `killed/total` is the last measured score.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
// MUTATION_FLOOR_FILE lets the RED fixtures point --check at a hermetic temp score file without
// touching the committed one (the same env-seam pattern the ledger fixtures use). Production runs
// leave it unset and hit conformance/mutation-floor.json.
const FLOOR = process.env.MUTATION_FLOOR_FILE || join(ROOT, "conformance", "mutation-floor.json");
const STRYKER_CONF = join(ROOT, "stryker.conf.json");

const die = (msg) => { console.error("FAIL L14 mutation: " + msg); process.exit(1); };

// ── validation shared by --check and --run ────────────────────────────────────
// Parse + structurally validate a score file. Returns { targets } or throws a legible message.
function parseScore(file) {
  let doc;
  try { doc = JSON.parse(readFileSync(file, "utf8")); }
  catch (e) { throw new Error(`${file} is not valid JSON: ${e.message}`); }
  if (!doc || typeof doc !== "object") throw new Error(`${file} is not an object`);
  const targets = doc.targets;
  if (targets === undefined) throw new Error(`${file} missing a "targets" object`);
  if (typeof targets !== "object" || targets === null || Array.isArray(targets))
    throw new Error(`${file} "targets" must be an object`);
  return doc;
}

// The committed HEAD floor for a target id (via git), or null if not committed / unavailable.
// This is what makes the ratchet monotone: a working-tree floor may not dip below HEAD's.
function headFloor(id) {
  // Only meaningful for the real committed score file; a temp fixture file has no HEAD blob.
  if (FLOOR !== join(ROOT, "conformance", "mutation-floor.json")) {
    // Fixtures still get a ratchet check: the RED battery seeds the "committed" baseline by
    // copying the real file's target at a HIGHER floor, so honor an explicit __headFloor hint.
    return null;
  }
  try {
    const blob = execFileSync("git", ["show", "HEAD:conformance/mutation-floor.json"],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const doc = JSON.parse(blob);
    const t = doc?.targets?.[id];
    return t && typeof t.floor === "number" ? t.floor : null;
  } catch { return null; } // not committed yet (first landing) — no HEAD floor to ratchet against.
}

// ── --check: the cheap floor read the gate runs ───────────────────────────────
function cmdCheck() {
  // EMPTY-GUARD: no score file yet → the honest "no mutation run recorded" bootstrap state
  // passes trivially (l17-style), so the gate never blocks before the first --run (CLAUDE.md R1).
  if (!existsSync(FLOOR)) { console.log("PASS L14 mutation (no score file yet — bootstrap)"); return; }
  let doc;
  try { doc = parseScore(FLOOR); } catch (e) { die(e.message); }
  const ids = Object.keys(doc.targets);
  if (ids.length === 0) { console.log("PASS L14 mutation (zero targets — bootstrap)"); return; }

  const problems = [];
  for (const id of ids) {
    const t = doc.targets[id];
    if (!t || typeof t !== "object") { problems.push(`target ${id}: not an object`); continue; }
    const { killed, total, floor } = t;
    for (const [k, v] of [["killed", killed], ["total", total], ["floor", floor]])
      if (typeof v !== "number" || !Number.isFinite(v)) problems.push(`target ${id}: field ${k} must be a finite number`);
    if (problems.length && problems[problems.length - 1].startsWith(`target ${id}`)) continue;
    if (killed < 0 || total < 0) problems.push(`target ${id}: killed/total must be >= 0`);
    if (killed > total) problems.push(`target ${id}: killed (${killed}) > total (${total}) — malformed score`);
    if (total === 0) problems.push(`target ${id}: total == 0 — no mutants measured for a declared target`);
    if (floor < 0 || floor > 1) problems.push(`target ${id}: floor ${floor} out of [0,1]`);
    if (total > 0) {
      const score = killed / total;
      if (score < floor - 1e-9)
        problems.push(`target ${id}: mutation score ${killed}/${total}=${score.toFixed(4)} is BELOW floor ${floor} — a surviving mutant escaped the suite (§8)`);
    }
    // RATCHET: the floor may only rise. A working-tree floor below the committed HEAD floor is a
    // loosening edit (someone lowered the bar to make a weak suite pass) → fail loud.
    const hf = t.__headFloor ?? headFloor(id);
    if (typeof hf === "number" && floor < hf - 1e-9)
      problems.push(`target ${id}: floor ${floor} was LOWERED below its committed HEAD value ${hf} — the mutation floor only rises (CLAUDE.md R1)`);
  }
  if (problems.length) die(problems.join("\n  "));
  console.log(`PASS L14 mutation (${ids.length} target(s) at/above floor)`);
}

// ── --run: the slow Stryker pass that updates the score ───────────────────────
// Runs Stryker over one target (a config `target` key in stryker.conf.json's mutate globs is
// selected by --run <id>) or the default set, parses the JSON report Stryker writes, and rewrites
// the score file RAISING floors that improved. This is the ONLY writer of killed/total/floor.
function cmdRun(id) {
  if (!existsSync(STRYKER_CONF)) die(`stryker.conf.json missing — cannot --run`);
  // Stryker is a devDependency; if not installed, say so honestly rather than faking a score.
  const strykerBin = join(ROOT, "node_modules", ".bin", "stryker");
  if (!existsSync(strykerBin)) {
    console.error("scripts/mutation.mjs --run: Stryker is not installed (npm i -D @stryker-mutator/core).");
    console.error("The floor stays at its committed value; --check still gates on the last recorded score.");
    process.exit(2);
  }
  // Run Stryker; it emits a json report to reports/mutation/mutation.json (configured in the conf).
  const args = ["run", STRYKER_CONF];
  console.error(`scripts/mutation.mjs --run: ${strykerBin} ${args.join(" ")}${id ? ` (target ${id})` : ""}`);
  try {
    execFileSync(strykerBin, args, { cwd: ROOT, stdio: "inherit",
      env: { ...process.env, ...(id ? { STRYKER_TARGET: id } : {}) } });
  } catch (e) {
    // A nonzero Stryker exit can mean "score below the configured threshold" — we still want the
    // measured numbers to update the floor read, so parse the report if it exists before bailing.
    console.error(`stryker exited nonzero (${e.status}); parsing report if present…`);
  }
  const report = join(ROOT, "reports", "mutation", "mutation.json");
  if (!existsSync(report)) die(`Stryker produced no report at ${report}`);
  let json;
  try { json = JSON.parse(readFileSync(report, "utf8")); } catch (e) { die(`unreadable Stryker report: ${e.message}`); }
  // Stryker report v1: files{ "<path>": { mutants[].status ∈ Killed/Survived/NoCoverage/Timeout } }
  let killed = 0, total = 0;
  const mutatedPaths = Object.keys(json.files ?? {}).sort();
  for (const f of Object.values(json.files ?? {})) {
    for (const m of f.mutants ?? []) {
      total++;
      if (m.status === "Killed" || m.status === "Timeout") killed++;
    }
  }
  if (total === 0) die(`Stryker report had zero mutants (nothing to measure)`);
  const doc = existsSync(FLOOR) ? parseScore(FLOOR) : { $schema: "mutation-floor/v1", targets: {} };
  const key = id || "harness";
  const prevFloor = doc.targets[key]?.floor ?? 0;
  const score = killed / total;
  // RAISE the floor to the freshly proven score (rounded down to 2dp so noise never re-reds); the
  // floor NEVER drops (max with the previous). killed/total record the exact measured numbers.
  const newFloor = Math.max(prevFloor, Math.floor(score * 100) / 100);
  // Record the actual mutated file(s) Stryker reported (accurate audit trail), preserving any
  // hand-authored path/_note already present.
  const path = doc.targets[key]?.path ?? (mutatedPaths.length === 1 ? mutatedPaths[0] : mutatedPaths.join(", "));
  doc.targets[key] = { ...doc.targets[key], path, killed, total, floor: newFloor };
  writeFileSync(FLOOR, JSON.stringify(doc, null, 2) + "\n");
  console.log(`recorded ${key}: ${killed}/${total} (score ${(score * 100).toFixed(1)}%), floor now ${newFloor}`);
}

const mode = process.argv[2];
if (mode === "--check") cmdCheck();
else if (mode === "--run") cmdRun(process.argv[3]);
else { console.error("usage: mutation.mjs --check | --run [target]"); process.exit(2); }
