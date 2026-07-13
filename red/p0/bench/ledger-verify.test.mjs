// W2.2 RED: the bench LEDGER.json integrity verifier as the gate check L12 drives it. A hand
// edit that LOOSENS a locked_ratio (raises it so a slower run passes) without re-sealing the
// integrity chain must be caught by bench/verify.mjs (nonzero exit) — the same shape the gate's
// l12 relies on. The committed bench/LEDGER.json (with its recorded build-time baseline) must
// itself verify clean. Uses the real verifier over a scratch copy; the RATCHET MATH cases live
// in ratchet-math.test.mjs (injected medians there). SHIM: migrates to .lg at W2.9.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, cpSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const VERIFY = join(ROOT, "bench", "verify.mjs");
const LEDGER = join(ROOT, "bench", "LEDGER.json");
const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

const run = (path) => {
  try {
    const out = execFileSync("node", [VERIFY, "--ledger", path], { encoding: "utf8" });
    return { code: 0, out };
  } catch (e) { return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") }; }
};

// ── the committed ledger must verify clean (and carry the build-time baseline) ──────
check(existsSync(LEDGER), "bench/LEDGER.json must exist");
if (existsSync(LEDGER)) {
  const r = run(LEDGER);
  check(r.code === 0, `the committed bench/LEDGER.json must verify clean; output:\n${r.out}`);

  const doc = JSON.parse(readFileSync(LEDGER, "utf8"));
  const suites = doc.suites || [];
  // FOUR metric kinds must be representable/present as the ratcheted metric taxonomy.
  const KINDS = new Set(["wall-clock", "peak-rss", "binary-size", "build-time"]);
  for (const s of suites) check(KINDS.has(s.metric), `suite ${s.suite} has an unknown metric kind "${s.metric}"`);

  // the build-time baseline (W0.D measured logos-bun's own release build) must be recorded.
  const bt = suites.find((s) => s.metric === "build-time");
  check(!!bt, "a build-time baseline suite (logos-bun's own largo build — G11 evidence) must be recorded");
  if (bt) check(typeof bt.baseline_seconds === "number" && bt.baseline_seconds > 0,
    `the build-time baseline must record a positive seconds value; got ${bt && bt.baseline_seconds}`);
}

// ── the loosening attack against a REAL committed-shape ledger → must be caught ──────
if (existsSync(LEDGER)) {
  const doc = JSON.parse(readFileSync(LEDGER, "utf8"));
  if ((doc.suites || []).length > 0) {
    const work = mkdtempSync(join(tmpdir(), "bench-verify-"));
    const tPath = join(work, "LEDGER.json");
    cpSync(LEDGER, tPath);
    const t = JSON.parse(readFileSync(tPath, "utf8"));
    // loosen the first suite's lock upward (a slower run would now pass) but keep the old digest.
    t.suites[0].locked_ratio = t.suites[0].locked_ratio + 1.0;
    writeFileSync(tPath, JSON.stringify(t, null, 2) + "\n");
    const r = run(tPath);
    check(r.code !== 0, "a loosening hand-edit (locked_ratio raised, integrity digest stale) must be caught by verify.mjs (want nonzero)");
    check(/integrity|digest|chain|seal/i.test(r.out), `the failure must name the integrity break; output:\n${r.out}`);
  }
}

// ── empty-suite guard: a ledger with no locks yet verifies trivially ────────────────
{
  const work = mkdtempSync(join(tmpdir(), "bench-empty-"));
  const ePath = join(work, "LEDGER.json");
  writeFileSync(ePath, JSON.stringify({ suites: [] }, null, 2) + "\n");
  const r = run(ePath);
  check(r.code === 0, `an empty-suite ledger (no locks yet) must verify trivially; output:\n${r.out}`);
}

if (fails.length) {
  for (const f of fails) console.error("FAIL ledger-verify: " + f);
  process.exit(1);
}
console.log("PASS ledger-verify (committed ledger clean + build-time baseline + loosening caught + empty guard)");
