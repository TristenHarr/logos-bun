// W1.2 RED (ratchet-at-exit) — L5 assert-parity. This is the ratchet the runner's assert
// capture EXISTS to power: once a key is PASS at asserts=N, its CURRENT recorded asserts (the
// latest verdict in the chained run store) may never drop below N. A test that quietly stops
// executing assertions — the classic "I refactored and half the expects vanished" rot, and the
// L5 anti-skip case where a body gets `.skip`ped — would keep its green PASS row while its real
// evidence collapses. L5 catches exactly that: PASS row asserts (promotion-time value, field 5)
// vs the run store's current asserts for the same key; current < promotion-time ⇒ gate FAIL.
//
// The check is `scripts/lints/assert-parity-lint.mjs`, which REUSES ledger-lint's
// parseLedger/priorState (it does not reimplement the parser or the chain). It is wired into
// gate.sh as `l5` in the l1/l2/l3 style. This battery is its spec:
//   A. DROP — PASS asserts=5, run store current=3 ⇒ the lint FAILS, tagged `L5 assert-parity`.
//   B. HOLD — PASS asserts=5, run store current=5 ⇒ the lint PASSES (equal is fine).
//   C. GROW — PASS asserts=5, run store current=7 ⇒ the lint PASSES (a proof may strengthen).
//   D. NO-EVIDENCE — PASS with no run-store row for the key ⇒ the lint does NOT fail on L5
//      (that is L2-provenance's job; L5 only fires on a real recorded DROP, never double-jeopardy).
//   E. LATEST-WINS — multiple run-store rows across timestamps; L5 reads the MOST RECENT ts's
//      asserts (a drop in the latest run is the regression, even if older runs were high).
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const LINT = join(ROOT, "scripts", "lints", "assert-parity-lint.mjs");
const fails = [];

const GENESIS = "0".repeat(64);
function chainDigest(prev, body) {
  return createHash("sha256").update(Buffer.concat([Buffer.from(prev, "utf8"), Buffer.from(body, "utf8")])).digest("hex");
}
function seal(body) { return body + "#CHAIN " + chainDigest(GENESIS, body) + "\n"; }

// build a hermetic fixture: a genesis-chained ledger with one PASS row (asserts=N) and a
// genesis-chained run store with the given rows. The tmpdir is outside any git repo, so
// priorState resolves prev=GENESIS (SCHEMA §4 step 2 → step 3) and the genesis-sealed chains
// validate. No .head snapshot is needed (L5 does not do monotonicity — that is L2's seam).
function fixture({ pass, runRows }) {
  const dir = mkdtempSync(join(tmpdir(), "l5-"));
  mkdirSync(join(dir, "runs"), { recursive: true });
  const key = "src/toy.lg::good";
  const ledgerBody = `PASS\tA\t${key}\t${"a".repeat(40)}\t${pass}\tpromoted\n`;
  writeFileSync(join(dir, "p0.tsv"), seal(ledgerBody));
  if (runRows !== null) {
    const runBody = runRows.map((r) => r.join("\t")).join("\n") + "\n";
    writeFileSync(join(dir, "runs", "p0.runs.tsv"), seal(runBody));
  }
  return { dir, ledger: join(dir, "p0.tsv") };
}

function lint(ledger) {
  try {
    const out = execFileSync("node", [LINT, ledger], { encoding: "utf8", env: { ...process.env, LEDGER_TODAY: "2026-07-13" } });
    return { code: 0, out };
  } catch (e) { return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") }; }
}

const KEY = "src/toy.lg::good";

// A. DROP — must FAIL, tagged L5.
{
  const { ledger } = fixture({ pass: "5", runRows: [["2026-07-12T00:00:00Z", KEY, "pass", "3"]] });
  const r = lint(ledger);
  if (r.code === 0) fails.push(`DROP: lint passed but PASS asserts=5 vs current run-store asserts=3 is a regression\n${r.out}`);
  if (!/L5 assert-parity/i.test(r.out)) fails.push(`DROP: lint did not tag the failure "L5 assert-parity"; output:\n${r.out}`);
}

// B. HOLD — equal is fine, must PASS.
{
  const { ledger } = fixture({ pass: "5", runRows: [["2026-07-12T00:00:00Z", KEY, "pass", "5"]] });
  const r = lint(ledger);
  if (r.code !== 0) fails.push(`HOLD: lint failed on equal asserts (5 vs 5), must pass\n${r.out}`);
}

// C. GROW — current above promotion-time is fine, must PASS.
{
  const { ledger } = fixture({ pass: "5", runRows: [["2026-07-12T00:00:00Z", KEY, "pass", "7"]] });
  const r = lint(ledger);
  if (r.code !== 0) fails.push(`GROW: lint failed on grown asserts (7 vs 5), must pass\n${r.out}`);
}

// D. NO-EVIDENCE — a PASS with no run-store row for the key must NOT trip L5 (L2's job).
{
  const { ledger } = fixture({ pass: "5", runRows: [["2026-07-12T00:00:00Z", "src/toy.lg::other", "pass", "9"]] });
  const r = lint(ledger);
  if (r.code !== 0 && /L5 assert-parity/i.test(r.out)) fails.push(`NO-EVIDENCE: L5 fired without a recorded run for the key (double-jeopardy with L2)\n${r.out}`);
}

// E. LATEST-WINS — most-recent timestamp's asserts is authoritative; a drop in the latest run
// is a regression even though an older run was high.
{
  const { ledger } = fixture({ pass: "5", runRows: [
    ["2026-07-10T00:00:00Z", KEY, "pass", "9"],  // old, high
    ["2026-07-12T00:00:00Z", KEY, "pass", "3"],  // latest, DROPPED
  ] });
  const r = lint(ledger);
  if (r.code === 0) fails.push(`LATEST-WINS: lint passed but the LATEST run dropped to asserts=3 (< 5)\n${r.out}`);
  if (!/L5 assert-parity/i.test(r.out)) fails.push(`LATEST-WINS: not tagged L5 assert-parity; output:\n${r.out}`);
}

if (fails.length) {
  for (const f of fails) console.error("FAIL l5-assert-parity: " + f);
  process.exit(1);
}
console.log("PASS l5-assert-parity");
