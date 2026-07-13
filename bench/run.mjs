#!/usr/bin/env node
// bench/run — drives a bench suite on pinned hardware and reports ratio = ours / oracle as a
// 3-run MEDIAN (BAKE_A_BUN §9.1), with a rolling per-suite noise σ (floor 5%). It measures with
// hyperfine (installed), then hands the median to the SHARED ratchet math in lib.mjs — so the
// run driver and the RED battery evaluate the wire/win with byte-identical arithmetic, the
// battery just injects its medians instead of measuring them.
//
// Usage:
//   bench/run.mjs --suite <name> --metric wall-clock --ours '<cmd>' --oracle '<cmd>' [--runs 3]
//   bench/run.mjs --suite <name> --metric build-time --build            (self-referential largo build)
//   bench/run.mjs --suite <name> --metric binary-size --ours-bin <path> --oracle-bin <path>
//
// It EVALUATES against bench/LEDGER.json (regression wire, confirm-before-freeze) and PRINTS the
// verdict — it does NOT mutate locks. Win-locks + confirmed-regression freezes are the nightly
// job's business (evaluateWinLock / the confirmatory re-run), exactly like ratchet.mjs owns the
// conformance ledger's PASS set. npm-world tooling per CLAUDE.md R3.
import { readFileSync, existsSync, statSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  median, rollingSigma, regressionWire, winThreshold, evaluateRegression, METRIC_KINDS,
} from "./lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const LEDGER = join(HERE, "LEDGER.json");

function arg(name, dflt = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : dflt;
}
function flag(name) { return process.argv.includes(name); }

const SUITE = arg("--suite");
const METRIC = arg("--metric", "wall-clock");
const RUNS = Number(arg("--runs", "3"));
if (!SUITE) { console.error("usage: run.mjs --suite <name> --metric <kind> [...]"); process.exit(2); }
if (!METRIC_KINDS.includes(METRIC)) { console.error(`unknown metric "${METRIC}" (${METRIC_KINDS.join("|")})`); process.exit(2); }

// ── the metric samplers: each returns a MEDIAN measurement for one shot ─────────
// hyperfine drives wall-clock (and, via /usr/bin/time, peak-RSS); build-time and binary-size are
// direct one-shot measurements. All return a single scalar so median()/ratio share one path.
function hyperfineMedian(cmd, runs) {
  const out = mkdtempSync(join(tmpdir(), "hf-"));
  const jsonPath = join(out, "hf.json");
  execFileSync("hyperfine", ["--runs", String(runs), "--warmup", "1", "--export-json", jsonPath, "--shell=none", cmd],
    { stdio: "ignore" });
  const j = JSON.parse(readFileSync(jsonPath, "utf8"));
  return j.results[0].median; // hyperfine's own median over its runs (seconds)
}
function peakRssBytes(cmd) {
  // /usr/bin/time -v reports "Maximum resident set size (kbytes)".
  const res = execFileSync("/usr/bin/time", ["-v", "sh", "-c", cmd], { encoding: "utf8", stdio: ["ignore", "ignore", "pipe"] });
  const m = res.match(/Maximum resident set size \(kbytes\):\s*(\d+)/);
  if (!m) throw new Error("peakRssBytes: could not parse /usr/bin/time -v output");
  return Number(m[1]) * 1024;
}
function fileBytes(p) { return statSync(p).size; }
function largoBuildSeconds() {
  const t0 = process.hrtime.bigint();
  execFileSync(join(ROOT, "scripts", "build.sh"), ["--release"], { stdio: "ignore" });
  return Number(process.hrtime.bigint() - t0) / 1e9;
}

// take a 3-run median-of-medians for one side (each of RUNS shots is itself a robust reading).
function sample(side, kind, n) {
  const shots = [];
  for (let i = 0; i < n; i++) {
    if (kind === "wall-clock") shots.push(hyperfineMedian(side.cmd, RUNS));
    else if (kind === "peak-rss") shots.push(peakRssBytes(side.cmd));
    else if (kind === "binary-size") shots.push(fileBytes(side.bin));
    else if (kind === "build-time") shots.push(largoBuildSeconds());
  }
  return median(shots);
}

// ── measure ─────────────────────────────────────────────────────────────────
let ratio, oursVal, oracleVal;
if (METRIC === "build-time") {
  // self-referential: build-time ratchets against its OWN recorded baseline_seconds, not an
  // oracle bun. ratio = measured / baseline (locked_ratio 1.0 = "no slower than the baseline").
  oursVal = sample({}, "build-time", 1);
  const doc = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : { suites: [] };
  const rec = (doc.suites || []).find((s) => s.suite === SUITE && s.metric === "build-time");
  oracleVal = rec && rec.baseline_seconds ? rec.baseline_seconds : oursVal;
  ratio = oursVal / oracleVal;
} else if (METRIC === "binary-size") {
  oursVal = sample({ bin: arg("--ours-bin") }, "binary-size", 1);
  oracleVal = sample({ bin: arg("--oracle-bin") }, "binary-size", 1);
  ratio = oursVal / oracleVal;
} else {
  const ours = { cmd: arg("--ours") }, oracle = { cmd: arg("--oracle") };
  if (!ours.cmd || !oracle.cmd) { console.error("wall-clock/peak-rss need --ours and --oracle commands"); process.exit(2); }
  oursVal = sample(ours, METRIC, 3);   // 3-run median (§9.1)
  oracleVal = sample(oracle, METRIC, 3);
  ratio = oursVal / oracleVal;
}

// ── evaluate against the lock ──────────────────────────────────────────────────
const doc = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : { suites: [] };
const rec = (doc.suites || []).find((s) => s.suite === SUITE && s.metric === METRIC);
if (!rec) {
  console.log(`bench/run: ${SUITE} [${METRIC}] ratio=${ratio.toFixed(4)} — no lock yet (candidate; nightly promote decides)`);
  process.exit(0);
}
const sigma = rollingSigma(rec.sigma_window || []);
const wire = regressionWire(rec.locked_ratio, sigma);
const win = winThreshold(rec.locked_ratio, sigma);
// a single run cannot freeze: report as sample #1, confirm-before-freeze runs on the nightly.
const verdict = evaluateRegression({ locked_ratio: rec.locked_ratio, sigma, samples: [ratio] });
console.log(
  `bench/run: ${SUITE} [${METRIC}] ratio=${ratio.toFixed(4)} ` +
  `locked=${rec.locked_ratio} σ=${sigma.toFixed(4)} win=${win.toFixed(4)} wire=${wire.toFixed(4)} ` +
  (ratio > wire ? "ABOVE WIRE (pending confirmatory re-run — never an instant freeze)"
                : ratio < win ? "BELOW WIN THRESHOLD (win candidate — needs 3 consecutive nightlies)"
                              : "in-band (steady state)"));
process.exit(0);
