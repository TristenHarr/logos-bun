#! /usr/bin/env node
// conformance/runner.mjs — logos-bun's conformance test runner, FORKED from
// vendor/bun/scripts/runner.node.mjs (READ-ONLY vendor; copied, never modified — CLAUDE.md
// R5). It keeps that runner's core discipline — run each test file in a separate process to
// catch crashes, and its `--exec-path` plumbing (the subject binary is resolved+validated the
// same way, `getExecPath`/`isExecutable`, PATH combined so the binary finds its siblings) —
// and drops the ~2700 lines of BuildKite/GitHub-CI/ASAN/docker/vendor-install machinery that
// have no place in a lane-A conformance seam.
//
// It is PERMANENT node (CLAUDE.md R3 carve-out): it hosts bun's OWN TypeScript test suite,
// which cannot be expressed in `.lg`. Its RED driver is the shim allowlisted → W2.9.
//
// Added over the vendor plumbing (W1.2 card):
//   --exec-path <bin>    the SUBJECT binary (logos-bun at M2; node for the toy suite). KEPT.
//   --oracle-path <bin>  the oracle-bun binary (comparator / Lane-A host). Recorded in the
//                        candidate note; the runner does not need it to classify the subject,
//                        but the seam carries it for the diff-comparators (W1.x).
//   --lane A|B|C         tags every emitted row's LANE field (SCHEMA §2.2). Lane-A = the
//                        oracle hosts and logos-bun is the spawned subject (§6.2).
//   --ledger <name.tsv>  the candidate QUEUE path. Its basename names the run store beside it
//                        (runs/<name>.runs.tsv). The runner writes the QUEUE + the RUN STORE,
//                        but NEVER a committed ledger PASS row — promote.mjs is the sole PASS
//                        writer (SCHEMA §6).
//   --cwd <dir>          the directory whose *.test.*/*.spec.* files are discovered + run.
//   --junit <dir>        per-file JUnit XML sink.
//   --assert-import <m>  a module injected into the subject (`node --import <m>`) that installs
//                        the executed-assertion counter dumping to the documented sink
//                        ($BUN_ASSERT_COUNT_FILE). At M2 this is bun's own counter patch.
//
// ── THE RUN-STORE / QUEUE SEAM (design decision; see the card's FINAL REPORT) ────────────────
// promote.mjs is the SOLE writer of PASS *ledger* rows. The runner writes only:
//   • the candidate QUEUE (`<ledger>`) — a neutral, UNCHAINED list of SCHEMA-shaped candidate
//     rows (STATUS ⇥ LANE ⇥ key ⇥ - ⇥ asserts ⇥ note); it is NOT a committed ledger and carries
//     no PASS-into-a-ledger authority;
//   • the RUN STORE (`runs/<name>.runs.tsv`) — the tamper-evident evidence file
//     (ts ⇥ key ⇥ verdict ⇥ asserts), CHAINED with the same #CHAIN discipline as every ledger
//     (SCHEMA §6.1 explicitly: "the store is written by the CI test runner").
// The runner writes the run store through `sealRunStore`, which reuses W1.1's `chainDigest`
// + `priorState` from ledger-lint.mjs — it does NOT reimplement sha256 chaining. promote.mjs
// then reads THAT store to verify 5/5-across-≥2-timestamps before it, and only it, flips a
// ledger row to PASS. So: runner emits evidence; promote alone mints PASS; the chain lives in
// exactly one place. `sealLedger`/`sealRunStore` are exported so the RED handshake can prove
// the emitted evidence is promote-consumable (a divergent chain would make promote refuse).

import { spawnSync } from "node:child_process";
import {
  accessSync,
  constants as FS,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseLedger, chainDigest, priorState } from "../scripts/lints/ledger-lint.mjs";

// ── exported chain-seal helpers (reuse W1.1's chain; never reimplement sha256) ───────────────
// sealRunStore(rows, path): rows = the run-store body (ts⇥key⇥verdict⇥asserts lines, each \n-
// terminated). Recomputes the trailer over the prior committed state (snapshot > HEAD > GENESIS,
// SCHEMA §4) and returns the fully sealed file text. Used by the runner AND the RED handshake.
export function sealRunStore(bodyRows, storePath) {
  const body = bodyRows.endsWith("\n") || bodyRows === "" ? bodyRows : bodyRows + "\n";
  const prev = priorState(storePath).prevChain;
  return body + "#CHAIN " + chainDigest(prev, body) + "\n";
}
// sealLedger(body, path): same for a ledger body — used by the RED handshake to build a
// candidate ledger promote.mjs can then flip. The runner itself never seals a committed ledger.
export function sealLedger(body, ledgerPath) {
  const b = body.endsWith("\n") || body === "" ? body : body + "\n";
  const prev = priorState(ledgerPath).prevChain;
  return b + "#CHAIN " + chainDigest(prev, b) + "\n";
}

// ── exec-path plumbing (ported faithfully from the vendor runner) ────────────────────────────
export function isExecutable(execPath) {
  if (!existsSync(execPath) || !statSync(execPath).isFile()) return false;
  try { accessSync(execPath, FS.X_OK); return true; } catch { return false; }
}
// getExecPath — resolve the subject binary. A directly-runnable file (node, or an absolute
// logos-bun binary) is used as-is; otherwise fall back to the vendor probe
// `<bin> --print process.argv[0]` to canonicalize a PATH-looked-up `bun`.
export function getExecPath(bunExe) {
  if (isExecutable(bunExe)) return bunExe;
  // a bare command name (e.g. "node", "bun") on PATH — resolve via the shell's `command -v`.
  try {
    const r = spawnSync(process.platform === "win32" ? "where" : "command", process.platform === "win32" ? [bunExe] : ["-v", bunExe],
      { encoding: "utf8", shell: process.platform !== "win32" });
    const p = (r.stdout || "").split("\n")[0].trim();
    if (p && isExecutable(p)) return p;
  } catch { /* fall through */ }
  try {
    const { error, stdout } = spawnSync(bunExe, ["--print", "process.argv[0]"], {
      encoding: "utf-8",
      env: { PATH: process.env.PATH, BUN_DEBUG_QUIET_LOGS: "1" },
    });
    if (error) throw error;
    const p = (stdout || "").trim();
    if (p && isExecutable(p)) return p;
  } catch { /* fall through to the loud error */ }
  throw new Error(`runner: could not find an executable subject at --exec-path "${bunExe}"`);
}
function combinedPath(execPath) {
  const dir = dirname(execPath);
  return process.env.PATH ? `${dir}:${process.env.PATH}` : dir;
}

// ── the executed-assertion sink parser ($BUN_ASSERT_COUNT_FILE) ───────────────────────────────
// Two writers feed the same sink. The real bun counter (0002-assert-counter.patch) APPENDS one
// `<file>\t<count>\n` line per test file — a run over several files leaves several lines whose
// executed total is their SUM. The toy sidecar (red/p0/runner/toy/assert-counter.mjs) writes a
// BARE number. Both are the TRAILING tab-separated field of a line, so: for each non-empty line
// take its last tab field as the count. A non-integer/negative trailing field contributes 0 for
// THAT line (never NaN-poisons the sum). An absent/empty sink is 0 (a file that ran no asserts).
export function parseAssertSink(raw) {
  let total = 0;
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    const fields = trimmed.split("\t");
    const n = Number.parseInt(fields[fields.length - 1].trim(), 10);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  return total;
}

// ── result classification (ported from the vendor parseTestStdout, trimmed to counts) ────────
// bun's runner emits per-test lines: ✓ pass · ✗ fail · » skip · ✎ todo. The toy counter's
// report() prints the same glyphs, so verdict + count come from one run.
function stripAnsi(s) { return s.replace(/\[[0-9;]*m/g, ""); }
function parseTestStdout(stdout) {
  const cases = [];
  let pass = 0, fail = 0, skip = 0, todo = 0;
  for (const chunk of stdout.split("\n")) {
    const s = stripAnsi(chunk);
    for (const { emoji, status } of [
      { emoji: "✓", status: "pass" },
      { emoji: "✗", status: "fail" },
      { emoji: "»", status: "skip" },
      { emoji: "✎", status: "todo" },
    ]) {
      if (!s.startsWith(emoji)) continue;
      let name = s.slice(emoji.length).trim();
      const b = name.lastIndexOf(" [");
      if (b >= 0 && name.endsWith("]")) name = name.slice(0, b); // drop a trailing ` [duration]`
      cases.push({ name, status });
      if (status === "pass") pass++; else if (status === "fail") fail++; else if (status === "skip") skip++; else todo++;
      break;
    }
  }
  return { cases, pass, fail, skip, todo };
}

// ── run one subject process over one test file ───────────────────────────────────────────────
// The subject is invoked as `<exec> [--import <assertMod>] <absPath>` when exec is a plain node
// (the toy suite / direct-exec), or `<exec> test <absPath>` when it is a bun-like binary. The
// assertion sink env is pointed at a fresh temp file the subject dumps its executed count into.
function runOne(execPath, absPath, opts) {
  const sinkDir = mkdtempSync(join(tmpdir(), "assert-"));
  const sink = join(sinkDir, "count");
  const env = {
    ...process.env,
    PATH: combinedPath(execPath),
    GITHUB_ACTIONS: "true",
    BUN_DEBUG_QUIET_LOGS: "1",
    BUN_ASSERT_COUNT_FILE: sink,        // the documented executed-assertion sink (W1.3)
  };
  const isNode = basename(execPath, extname(execPath)) === "node";
  // node's --import treats a bare relative path as a package specifier, so pass a file:// URL
  // (absolutized against CWD) — the specifier must be unambiguous regardless of how the caller
  // spelled --assert-import.
  const importSpec = opts.assertImport
    ? pathToFileURL(isAbsolute(opts.assertImport) ? opts.assertImport : resolve(process.cwd(), opts.assertImport)).href
    : null;
  const args = isNode
    ? (importSpec ? ["--import", importSpec, absPath] : [absPath])
    : ["test", "--reporter=dots", absPath];
  const res = spawnSync(execPath, args, { encoding: "utf8", env });
  const stdout = (res.stdout || "") + (res.stderr || "");
  let executed = 0;
  try {
    executed = parseAssertSink(readFileSync(sink, "utf8"));
  } catch { executed = 0; }
  try { rmSync(sinkDir, { recursive: true, force: true }); } catch { /* best effort */ }

  const parsed = parseTestStdout(stdout);
  // file-level status: fail if the subject crashed/nonzero OR any ✗ line; skip if the file
  // executed no assertions and every reported case was a skip; else pass.
  let status;
  if (res.status !== 0 || res.error || parsed.fail > 0) status = "fail";
  else if (executed === 0 && parsed.skip > 0 && parsed.pass === 0) status = "skip";
  else status = "pass";
  return { status, executed, ...parsed, exit: res.status };
}

// ── deterministic per-file junit XML (a golden — no timestamps, no host data) ────────────────
function xmlEscape(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
export function junitXml(fileKey, result) {
  const total = result.cases.length;
  const failures = result.fail;
  const skipped = result.skip + result.todo;
  const lines = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<testsuite name="${xmlEscape(fileKey)}" tests="${total}" failures="${failures}" skipped="${skipped}" asserts="${result.executed}">`);
  for (const c of result.cases) {
    if (c.status === "pass") lines.push(`  <testcase name="${xmlEscape(c.name)}"/>`);
    else if (c.status === "fail") lines.push(`  <testcase name="${xmlEscape(c.name)}"><failure/></testcase>`);
    else lines.push(`  <testcase name="${xmlEscape(c.name)}"><skipped/></testcase>`);
  }
  lines.push(`</testsuite>`);
  return lines.join("\n") + "\n";
}

// map a file verdict → a SCHEMA STATUS token for the candidate queue.
function schemaStatus(status) {
  if (status === "pass") return "PASS";
  if (status === "skip") return "SKIP";
  return "FAIL";
}
// map a file verdict → a run-store verdict (pass|fail). A skip is NOT a pass — it records as a
// fail with asserts=0 so it can never accumulate the 5 clean passes promote requires (L5).
function runVerdict(status) { return status === "pass" ? "pass" : "fail"; }

// ── discover the test files under --cwd ──────────────────────────────────────────────────────
function discover(dir) {
  const out = [];
  const rec = (d) => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, ent.name);
      if (ent.isDirectory()) rec(p);
      else if (/\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|cjs|mts)$/.test(ent.name)) out.push(p);
    }
  };
  rec(dir);
  return out.sort();
}

// ── main ─────────────────────────────────────────────────────────────────────────────────────
function main() {
  const { values: options, positionals: filters } = parseArgs({
    allowPositionals: true,
    options: {
      ["exec-path"]: { type: "string", default: "bun" },
      ["oracle-path"]: { type: "string", default: undefined },
      ["lane"]: { type: "string", default: "C" },
      ["ledger"]: { type: "string", default: "conformance/ledger/p0.tsv" },
      ["cwd"]: { type: "string", default: process.cwd() },
      ["junit"]: { type: "string", default: undefined },
      ["assert-import"]: { type: "string", default: undefined },
      ["key-prefix"]: { type: "string", default: "" },
      ["ts"]: { type: "string", default: undefined },
      ["quiet"]: { type: "boolean", default: false },
    },
  });

  const LANE = options.lane;
  if (!/^[ABC]$/.test(LANE)) { console.error(`runner: --lane must be A|B|C, got "${LANE}"`); process.exit(2); }
  const say = (...a) => { if (!options.quiet) console.log(...a); };

  const execPath = getExecPath(options["exec-path"]);
  say("subject:", execPath, "· lane:", LANE, "· oracle:", options["oracle-path"] ?? "(none)");

  const cwd = options.cwd;
  let files = discover(cwd);
  if (filters.length) files = files.filter((f) => filters.some((flt) => f.includes(flt)));

  const junitDir = options.junit;
  if (junitDir) mkdirSync(junitDir, { recursive: true });

  const ts = options.ts || new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const queuePath = options.ledger;
  const runStorePath = join(dirname(queuePath), "runs", basename(queuePath).replace(/\.tsv$/, ".runs.tsv"));

  const queueRows = [];
  const runRows = [];
  let anyFail = false;

  for (const abs of files) {
    const rel = relative(cwd, abs);
    const key = options["key-prefix"] + rel;
    const result = runOne(execPath, abs, { assertImport: options["assert-import"] });
    if (result.status === "fail") anyFail = true;

    if (junitDir) {
      const junitName = "junit-" + rel.replace(/[\\/]/g, "__").replace(/\.(?:test|spec)\.[a-z]+$/, "") + ".xml";
      writeFileSync(join(junitDir, junitName), junitXml(key, result));
    }

    // candidate queue row (SCHEMA-shaped). asserts only on PASS; commit always `-` (the runner
    // never mints first-green-commit — promote does).
    const st = schemaStatus(result.status);
    const asserts = st === "PASS" ? String(result.executed) : (st === "SKIP" ? "0" : "-");
    const note = `lane=${LANE};oracle=${options["oracle-path"] ?? ""};executed=${result.executed}`;
    queueRows.push(`${st}\t${LANE}\t${key}\t-\t${asserts}\t${note}`);

    // run-store row (the tamper-evident evidence promote consumes).
    runRows.push(`${ts}\t${key}\t${runVerdict(result.status)}\t${result.status === "pass" ? result.executed : 0}`);

    say(`  ${st}\t${key}\tasserts=${result.executed}`);
  }

  // emit the NEUTRAL candidate queue (UNCHAINED — not a committed ledger).
  mkdirSync(dirname(queuePath), { recursive: true });
  writeFileSync(queuePath, queueRows.length ? queueRows.join("\n") + "\n" : "");

  // emit / append the CHAINED run store (evidence). Appends to any existing store body so
  // repeated runs accumulate the 5/5-across-≥2-timestamps promote needs.
  mkdirSync(dirname(runStorePath), { recursive: true });
  let existingBody = "";
  if (existsSync(runStorePath)) {
    const parsed = parseLedger(readFileSync(runStorePath, "utf8"), basename(runStorePath));
    existingBody = parsed.trailer !== null ? parsed.body : "";
  }
  const newBody = existingBody + (runRows.length ? runRows.join("\n") + "\n" : "");
  writeFileSync(runStorePath, sealRunStore(newBody, runStorePath));

  process.exit(anyFail ? 1 : 0);
}

// run main only when invoked directly; stay importable (the RED handshake imports the sealers).
function isMain() {
  const invoked = process.argv[1] ? fileURLToPath(new URL(`file://${process.argv[1]}`)) : "";
  return invoked && invoked.endsWith("runner.mjs");
}
if (isMain()) main();
