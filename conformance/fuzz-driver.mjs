// conformance/fuzz-driver.mjs — the §8 shared differential-fuzz driver every P2+ component
// reuses. One component = one probe (the LOGOS side, `probes/<c>.lg` at P2) + one oracle shim
// (`conformance/oracle/shims/<c>`), both speaking the SAME stdin→stdout byte protocol declared
// in `fuzz/<c>/PROBE.md`.
//
// The wire contract (PROBE.md is the human-readable, versioned copy):
//   • the driver writes a test case as raw bytes to each side's stdin, then closes it;
//   • each side writes its answer as raw bytes to stdout and exits;
//   • the component MATCHES on that case ⟺ probe.stdout === shim.stdout byte-for-byte AND the
//     exit codes agree. Anything else is a MISMATCH — a live differential divergence.
//
// On a mismatch the driver runs ddmin (delta-debugging) to shrink the case to a locally-minimal
// witness that STILL diverges, then BANKS that witness — content-addressed — under
// `fuzz/<c>/corpus/regressions/` FOREVER. The bank is append-only: `scripts/promote.mjs`-style
// discipline does not apply here because a regression seed is not a PASS row; it is a permanent
// repro that every gate run must reproduce cleanly (L13 replay). A banked seed is only ever
// removed by a human incident, never by the driver.
//
// `--replay` re-runs every banked witness for a component and REDS if any still diverges (a live
// bug). `--replay-all` walks every `fuzz/*/corpus/regressions/` — this is gate check L13. Both
// are DETERMINISTIC: witnesses are read in sorted (content-hash) order, each side is spawned with
// a fixed env, and no randomness enters replay.
//
// Anti-over-eagerness by construction: the driver never normalizes. A byte-mismatch is a
// mismatch — the §6.4 normalizers belong to diffcli, not here (a fuzz differential is raw).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
// FUZZ_ROOT lets fixtures point the whole fuzz tree at a hermetic tmp dir (RED battery). In
// production it is the repo root; `fuzz/<c>/…` hangs off it either way.
const FUZZ_ROOT = process.env.FUZZ_ROOT || ROOT;

// ── ddmin: generic delta-debugging minimizer (Zeller & Hildebrandt, ddmin) ────────────────────
// Given an input Buffer and a predicate `reproduces(Buffer) → bool` that is TRUE on the failing
// input, return a locally 1-minimal Buffer that still reproduces. The classic algorithm: try to
// remove ever-finer chunks (n = 2, then increase granularity toward per-atom) while preserving
// reproduction. Termination is guaranteed: `n` only grows and is capped at the current length, and
// every accepted step strictly shrinks the input, so the outer loop runs at most `input.length`
// times and each pass makes at most `2n` predicate probes.
export function ddmin(input, reproduces) {
  let data = Buffer.from(input);
  if (!reproduces(data)) return data;                 // caller's contract: input must reproduce
  let n = 2;
  while (data.length >= 2) {
    const chunk = Math.max(1, Math.floor(data.length / n));
    let reduced = false;

    // (1) try each single chunk as the whole reduced input (delta).
    for (let start = 0; start < data.length; start += chunk) {
      const sub = data.subarray(start, Math.min(start + chunk, data.length));
      if (sub.length && sub.length < data.length && reproduces(sub)) {
        data = Buffer.from(sub); n = 2; reduced = true; break;
      }
    }
    if (reduced) continue;

    // (2) try each COMPLEMENT (everything but one chunk).
    for (let start = 0; start < data.length; start += chunk) {
      const end = Math.min(start + chunk, data.length);
      const comp = Buffer.concat([data.subarray(0, start), data.subarray(end)]);
      if (comp.length && comp.length < data.length && reproduces(comp)) {
        data = comp; n = Math.max(n - 1, 2); reduced = true; break;
      }
    }
    if (reduced) continue;

    // (3) neither shrank at this granularity: refine, or stop when we are already per-atom.
    if (n >= data.length) break;
    n = Math.min(data.length, n * 2);
  }
  return data;
}

// ── the regression bank: content-addressed, append-only ───────────────────────────────────────
// A witness is banked under sha256(bytes).bin so identical mismatches never double-bank and the
// filename is a deterministic function of the bytes (replay order is therefore stable). Returns
// the witness path (existing or freshly written).
export function bankRegression(regressionsDir, bytes) {
  mkdirSync(regressionsDir, { recursive: true });
  const buf = Buffer.from(bytes);
  const digest = createHash("sha256").update(buf).digest("hex").slice(0, 32);
  const path = join(regressionsDir, `${digest}.bin`);
  if (!existsSync(path)) writeFileSync(path, buf);     // append-only: never overwrite a banked seed
  return path;
}

/** Every banked witness path under `regressionsDir`, deterministically (name-sorted) ordered. */
export function listRegressions(regressionsDir) {
  if (!existsSync(regressionsDir)) return [];
  return readdirSync(regressionsDir)
    .filter((f) => f.endsWith(".bin"))
    .sort()
    .map((f) => join(regressionsDir, f));
}

// ── the protocol: feed one case to a side, capture (stdout bytes, exit) ───────────────────────
function runSide(cmd, inputBuf) {
  // .lg probes and .mjs shims are node-runnable stubs here; a native shim binary is exec'd
  // directly. Real largo probes at P2 substitute the toolchain-built binary — same contract.
  const ext = extname(cmd);
  const isNode = ext === ".mjs" || ext === ".cjs" || ext === ".js";
  const argv = isNode ? [cmd] : [];
  const bin = isNode ? "node" : cmd;
  const r = spawnSync(bin, argv, {
    input: inputBuf,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env },
  });
  if (r.error) return { out: Buffer.alloc(0), exit: null, spawnError: String(r.error.message || r.error) };
  const exit = r.status !== null ? r.status : (r.signal ? 128 : null);
  return { out: r.stdout ?? Buffer.alloc(0), exit };
}

/**
 * Run one case under both sides and decide whether they diverge.
 * @returns {{diverges:boolean, reason?:string, probe:object, shim:object}}
 */
export function differential(probeCmd, shimCmd, inputBuf) {
  const p = runSide(probeCmd, inputBuf);
  const s = runSide(shimCmd, inputBuf);
  let diverges = false, reason;
  if (p.spawnError || s.spawnError) { diverges = true; reason = "spawn-error"; }
  else if (p.exit !== s.exit) { diverges = true; reason = `exit ${p.exit} != ${s.exit}`; }
  else if (!Buffer.from(p.out).equals(Buffer.from(s.out))) { diverges = true; reason = "stdout bytes differ"; }
  return { diverges, reason, probe: p, shim: s };
}

// ── component paths off FUZZ_ROOT ─────────────────────────────────────────────────────────────
function compDir(component) { return join(FUZZ_ROOT, "fuzz", component); }
function seedDir(component)  { return join(compDir(component), "corpus", "seed"); }
function regDir(component)   { return join(compDir(component), "corpus", "regressions"); }

/** Read every seed case for a component (name-sorted, deterministic). */
function readSeeds(component) {
  const dir = seedDir(component);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".bin")).sort()
    .map((f) => ({ name: f, bytes: readFileSync(join(dir, f)) }));
}

/**
 * Run every seed case through the differential. Any mismatch is ddmin-minimized and banked.
 * Returns the number of banked witnesses this pass produced.
 */
export function runSeeds(component, probeCmd, shimCmd, log = () => {}) {
  let banked = 0;
  for (const seed of readSeeds(component)) {
    const first = differential(probeCmd, shimCmd, seed.bytes);
    if (!first.diverges) continue;
    log(`[${component}] MISMATCH on seed ${seed.name}: ${first.reason}`);
    // minimize: "still diverges" is the predicate ddmin drives toward the floor.
    const witness = ddmin(seed.bytes, (buf) => differential(probeCmd, shimCmd, buf).diverges);
    const path = bankRegression(regDir(component), witness);
    log(`[${component}] banked minimal witness (${witness.length} byte${witness.length === 1 ? "" : "s"}) → ${path}`);
    banked++;
  }
  return banked;
}

/**
 * L13 replay for ONE component: every banked witness must NOT diverge (bug fixed). Returns the
 * list of witnesses that STILL diverge (empty = green).
 */
export function replayComponent(component, probeCmd, shimCmd, log = () => {}) {
  const still = [];
  for (const w of listRegressions(regDir(component))) {
    const bytes = readFileSync(w);
    const d = differential(probeCmd, shimCmd, bytes);
    if (d.diverges) { still.push(w); log(`[${component}] REPLAY RED: ${w} still diverges (${d.reason})`); }
  }
  return still;
}

/**
 * L13 replay for ALL components with a probe+shim resolvable from the standard layout. Empty
 * guard: a component with no `corpus/regressions/` (or no fuzz tree at all) contributes nothing,
 * so an empty fuzz tree passes trivially. Returns the total count of still-diverging witnesses.
 */
export function replayAll(log = () => {}) {
  const fuzzDir = join(FUZZ_ROOT, "fuzz");
  if (!existsSync(fuzzDir)) return 0;                  // no fuzz tree → trivially green (l17-style)
  let stillTotal = 0;
  for (const name of readdirSync(fuzzDir).sort()) {
    const rdir = regDir(name);
    const witnesses = listRegressions(rdir);
    if (witnesses.length === 0) continue;              // empty guard, per-component
    const probe = resolveProbe(name);
    const shim = resolveShim(name);
    if (!probe || !shim) {
      // a banked bug we cannot even re-run is a red state — a regression must always be replayable.
      log(`[${name}] REPLAY RED: ${witnesses.length} banked witness(es) but probe/shim unresolved`);
      stillTotal += witnesses.length;
      continue;
    }
    stillTotal += replayComponent(name, probe, shim, log).length;
  }
  return stillTotal;
}

// Resolve the standard probe/shim locations for a component (used by --replay-all). The RED
// battery passes them explicitly via flags; the production layout is fuzz-driver-owned here.
function resolveProbe(component) {
  for (const c of [join(FUZZ_ROOT, "probes", `${component}.lg`), join(FUZZ_ROOT, "probes", `${component}.mjs`)]) {
    if (existsSync(c)) return c;
  }
  return null;
}
function resolveShim(component) {
  const base = join(FUZZ_ROOT, "conformance", "oracle", "shims", component);
  for (const c of [join(base, "main"), join(base, "main.mjs"), base]) {
    if (existsSync(c)) return c;
  }
  return null;
}

// ── CLI ───────────────────────────────────────────────────────────────────────────────────────
// node fuzz-driver.mjs --component <c> --probe <p> --shim <s> --run-seeds
// node fuzz-driver.mjs --component <c> --probe <p> --shim <s> --replay
// node fuzz-driver.mjs --replay-all                                        (gate L13)
function parseArgs(raw) {
  const a = { flags: new Set() };
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    if (t === "--component") a.component = raw[++i];
    else if (t === "--probe") a.probe = raw[++i];
    else if (t === "--shim") a.shim = raw[++i];
    else if (t.startsWith("--")) a.flags.add(t.slice(2));
  }
  return a;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = parseArgs(process.argv.slice(2));
  const log = (m) => process.stderr.write(m + "\n");

  if (a.flags.has("replay-all")) {
    const still = replayAll(log);
    if (still > 0) { log(`fuzz-replay RED: ${still} banked witness(es) still diverge`); process.exit(1); }
    process.stdout.write("fuzz-replay GREEN (0 diverging witnesses)\n");
    process.exit(0);
  }

  if (!a.component || !a.probe || !a.shim) {
    log("usage: fuzz-driver.mjs --component <c> --probe <p> --shim <s> (--run-seeds|--replay)");
    log("       fuzz-driver.mjs --replay-all");
    process.exit(2);
  }

  if (a.flags.has("run-seeds")) {
    const banked = runSeeds(a.component, a.probe, a.shim, log);
    if (banked > 0) { log(`${banked} mismatch(es) minimized and banked for ${a.component}`); process.exit(1); }
    process.stdout.write(`no mismatches for ${a.component}\n`);
    process.exit(0);
  }

  if (a.flags.has("replay")) {
    const still = replayComponent(a.component, a.probe, a.shim, log);
    if (still.length > 0) { log(`replay RED: ${still.length} banked witness(es) still diverge for ${a.component}`); process.exit(1); }
    process.stdout.write(`replay GREEN for ${a.component} (0 diverging witnesses)\n`);
    process.exit(0);
  }

  log("nothing to do: pass --run-seeds, --replay, or --replay-all");
  process.exit(2);
}
