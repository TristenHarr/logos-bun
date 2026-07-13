// W1.2 RED — conformance/runner.mjs (forked from vendor/bun/scripts/runner.node.mjs) over the
// toy suite (pass / fail / skip). This battery IS the spec. For each discovered test file the
// runner must:
//   • run it under --exec-path (node here; the real bun binary at M2) and classify the file
//     verdict pass / fail / skip;
//   • capture the EXECUTED-ASSERTION count via the documented sink (BUN_ASSERT_COUNT_FILE,
//     populated by the --assert-import counter — W1.3's 0002-assert-counter.patch at M2);
//   • emit a SCHEMA-shaped candidate row into the --ledger QUEUE (a neutral candidate file,
//     NEVER a committed ledger — promote.mjs is the sole PASS writer, SCHEMA §6);
//   • emit run-store rows (ts ⇥ key ⇥ verdict ⇥ asserts) into runs/<name>.runs.tsv, chained
//     with the SAME #CHAIN discipline promote.mjs consumes (SCHEMA §6.1);
//   • write a per-file JUnit XML under --junit.
//
// L5 anti-skip: skip.spec.mjs yields asserts=0 — a VISIBLE delta vs pass.spec.mjs (asserts=3).
// A silently-skipped test can never masquerade as a passing run.
//
// The runner→promote handshake is proven LIVE: promote.mjs accepts a run store the runner
// sealed (5/5 across ≥2 timestamps) and writes PASS. A well-formed-but-unconsumable format
// would pass the shape checks yet FAIL here — this positive control proves the emitted evidence
// is real, and proves the runner reused W1.1's chain helper (a bad chain ⇒ promote refuses).
//
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9. runner.mjs itself is PERMANENT node
// (CLAUDE.md R3 carve-out — it hosts bun's own TS suite).
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const RUNNER = join(ROOT, "conformance", "runner.mjs");
const PROMOTE = join(ROOT, "scripts", "promote.mjs");
const TOY = join(HERE, "toy");
const GOLDENS = join(HERE, "goldens");
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

// keys the runner assigns: path relative to the --cwd it discovers under.
const KEY = { pass: "pass.spec.mjs", fail: "fail.spec.mjs", skip: "skip.spec.mjs" };

// import the runner's chain-seal helpers (used by the handshake). RED if the module is absent.
let sealRunStore, sealLedger;
try {
  ({ sealRunStore, sealLedger } = await import(pathToFileURL(RUNNER).href));
} catch (e) {
  console.error("FAIL runner: cannot import conformance/runner.mjs (does not exist yet?):\n" + (e.stack || e));
  process.exit(1);
}

// ── run the runner once over the whole toy suite ────────────────────────────────
const work = mkdtempSync(join(tmpdir(), "w12-runner-"));
const queue = join(work, "p0.tsv");            // candidate QUEUE (not a committed ledger)
const junitDir = join(work, "junit");
const runsDir = join(work, "runs");            // promote reads runs/<name>.runs.tsv beside the queue
mkdirSync(runsDir, { recursive: true });

let ran;
try {
  ran = execFileSync("node", [
    RUNNER,
    "--exec-path", "node",
    "--oracle-path", "node",
    "--lane", "A",
    "--cwd", TOY,
    "--ledger", queue,
    "--junit", junitDir,
    "--assert-import", join(TOY, "assert-counter.mjs"),
  ], { encoding: "utf8", env: { ...process.env, LEDGER_TODAY: "2026-07-13" } });
} catch (e) {
  // a nonzero exit is expected (fail.spec.mjs is red) — assert on ARTIFACTS, not exit code.
  ran = (e.stdout || "") + (e.stderr || "");
}

// ── 1. candidate QUEUE rows: verdicts + lane + asserts ──────────────────────────
if (!existsSync(queue)) {
  fails.push(`runner did not write the candidate queue at ${queue}; runner output:\n${ran}`);
} else {
  const rows = readFileSync(queue, "utf8").split("\n").filter((l) => l && !l.startsWith("#"));
  const byKey = new Map();
  for (const r of rows) byKey.set(r.split("\t")[2], r.split("\t"));
  // the queue must NOT be a chained artifact (it is a neutral candidate list, not a ledger).
  ok(!/#CHAIN /.test(readFileSync(queue, "utf8")), "candidate queue must not carry a #CHAIN trailer (only ledgers/run stores are chained)");

  const p = byKey.get(KEY.pass);
  ok(p, `no queue row for ${KEY.pass}`);
  if (p) {
    ok(p.length === 6, `pass row not 6 TAB fields: ${JSON.stringify(p)}`);
    ok(p[0] === "PASS", `pass row STATUS=${p[0]} want PASS`);
    ok(p[1] === "A", `pass row LANE=${p[1]} want A (--lane A)`);
    ok(p[4] === "3", `pass row asserts=${p[4]} want 3`);
  }

  const f = byKey.get(KEY.fail);
  ok(f, `no queue row for ${KEY.fail}`);
  if (f) {
    ok(f[0] === "FAIL", `fail row STATUS=${f[0]} want FAIL`);
    ok(f[1] === "A", `fail row LANE=${f[1]} want A`);
    ok(f[3] === "-", `fail row first-green-commit=${f[3]} want - (non-PASS)`);
    ok(f[4] === "-", `fail row asserts=${f[4]} want - (non-PASS)`);
  }

  const s = byKey.get(KEY.skip);
  ok(s, `no queue row for ${KEY.skip}`);
  if (s && p) {
    ok(s[4] === "0", `skip row asserts=${s[4]} want 0 (anti-skip signal)`);
    ok(s[4] !== p[4], `skip asserts (${s[4]}) must be a VISIBLE delta vs pass asserts (${p[4]})`);
    ok(s[0] !== "PASS", `skip row STATUS=${s[0]} must not be PASS (a skip must not masquerade as a pass)`);
  }
}

// ── 2. run-store rows in the EXACT shape promote.mjs consumes ────────────────────
const runStore = join(runsDir, "p0.runs.tsv");
if (!existsSync(runStore)) {
  fails.push(`runner did not write the run store at ${runStore} (promote reads runs/<name>.runs.tsv)`);
} else {
  const body = readFileSync(runStore, "utf8");
  ok(/\n#CHAIN [0-9a-f]{64}\n$/.test(body), `run store missing a valid #CHAIN trailer:\n${body}`);
  const dataRows = body.split("\n").filter((l) => l && !l.startsWith("#"));
  for (const r of dataRows) {
    const flds = r.split("\t");
    ok(flds.length === 4, `run-store row not 4 fields (ts⇥key⇥verdict⇥asserts): ${JSON.stringify(r)}`);
    ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(flds[0]), `run-store ts not ISO-8601 UTC: ${flds[0]}`);
    ok(flds[2] === "pass" || flds[2] === "fail", `run-store verdict=${flds[2]} want pass|fail`);
  }
  ok(dataRows.some((r) => r.includes(`\t${KEY.pass}\tpass\t3`)), `run store missing pass/3 for ${KEY.pass}`);
  ok(dataRows.some((r) => r.includes(`\t${KEY.fail}\tfail\t`)), `run store missing fail for ${KEY.fail}`);
}

// ── 3. per-file JUnit XML goldens (structure-exact after path/time normalization) ───
function normJunit(xml) {
  return xml
    .replace(/ time="[0-9.]+"/g, ' time="0.000"')
    .replace(/ timestamp="[^"]*"/g, ' timestamp="T"')
    .replace(/ hostname="[^"]*"/g, ' hostname="H"')
    .replace(new RegExp(TOY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "TOYDIR")
    .replace(/\r/g, "")
    .trimEnd();
}
if (!existsSync(junitDir)) {
  fails.push(`runner did not write JUnit XML under ${junitDir}`);
} else {
  const xmls = readdirSync(junitDir).filter((f) => f.endsWith(".xml")).sort();
  ok(xmls.length === 3, `want 3 per-file junit XMLs, got ${xmls.length}: ${xmls.join(", ")}`);
  for (const name of ["pass", "fail", "skip"]) {
    const goldenPath = join(GOLDENS, `junit-${name}.xml`);
    const produced = xmls.find((x) => x.includes(name));
    ok(produced, `no produced junit XML for ${name}`);
    if (!produced) continue;
    const got = normJunit(readFileSync(join(junitDir, produced), "utf8"));
    if (!existsSync(goldenPath)) { fails.push(`missing golden ${goldenPath}`); continue; }
    const want = normJunit(readFileSync(goldenPath, "utf8"));
    ok(got === want, `junit-${name} mismatch:\n--- got ---\n${got}\n--- want ---\n${want}`);
  }
}

// ── 4. runner→promote handshake: promote CONSUMES runner-sealed evidence ─────────
// A well-formed-but-unconsumable format would pass §2 yet fail here. This proves the runner's
// sealers (sealRunStore/sealLedger) produce a store+ledger promote.mjs actually promotes, and
// that they reuse W1.1's chain helper (a divergent chain ⇒ promote refuses "chain invalid").
ok(typeof sealRunStore === "function", "runner must export sealRunStore(rows, path) → sealed text");
ok(typeof sealLedger === "function", "runner must export sealLedger(body, path) → sealed text");
if (typeof sealRunStore === "function" && typeof sealLedger === "function") {
  const hs = mkdtempSync(join(tmpdir(), "w12-handshake-"));
  const led = join(hs, "p0.tsv");
  const rdir = join(hs, "runs");
  mkdirSync(rdir, { recursive: true });
  const key = "pass.spec.mjs";
  const runRows = [
    ["2026-07-11T00:00:00Z", key, "pass", "3"],
    ["2026-07-11T00:00:00Z", key, "pass", "3"],
    ["2026-07-12T00:00:00Z", key, "pass", "3"],
    ["2026-07-12T00:00:00Z", key, "pass", "3"],
    ["2026-07-13T00:00:00Z", key, "pass", "3"],
  ].map((r) => r.join("\t")).join("\n") + "\n";
  const runPath = join(rdir, "p0.runs.tsv");
  writeFileSync(runPath, sealRunStore(runRows, runPath));
  writeFileSync(led, sealLedger(`FAIL\tA\t${key}\t-\t-\tfrontier\n`, led));

  let out, code = 0;
  try {
    out = execFileSync("node", [PROMOTE, "--ledger", led, "--key", key],
      { encoding: "utf8", env: { ...process.env, LEDGER_TODAY: "2026-07-13", LEDGER_HEAD_SHA: "a".repeat(40) } });
  } catch (e) { code = e.status ?? 1; out = (e.stdout || "") + (e.stderr || ""); }
  ok(code === 0, `promote refused runner-emitted evidence (the format must be consumable):\n${out}`);
  const finalLed = existsSync(led) ? readFileSync(led, "utf8") : "";
  ok(/^PASS\tA\tpass\.spec\.mjs\t[0-9a-f]{40}\t3\t/m.test(finalLed),
    `promote did not write PASS from runner evidence; ledger:\n${finalLed}`);
}

if (fails.length) {
  for (const f of fails) console.error("FAIL runner: " + f);
  process.exit(1);
}
console.log("PASS runner");
