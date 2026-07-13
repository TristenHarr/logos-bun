// W2.2 RED: the speed/size/RSS/build-time ratchet MATH (BAKE_A_BUN §9.1), driven with
// INJECTED synthetic 3-run medians so the arithmetic is deterministic — hyperfine is never
// run here. Four cases lock the four properties §9.1 demands:
//   (a) a CONFIRMED regression (two samples above the wire)      → red
//   (b) a single noise-band blip (one above, re-run below)       → NOT red  (anti-deadlock)
//   (c) a "win" locks only after 3 consecutive improving runs,
//       and locks the WORSE end of that window (not the best-ever sample)
//   (d) a hand-edit loosening locked_ratio                        → detected (integrity chain)
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const LIB = join(ROOT, "bench", "lib.mjs");
const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

const {
  median,
  rollingSigma,
  regressionWire,
  winThreshold,
  evaluateRegression,
  evaluateWinLock,
  sealSuite,
  verifyLedger,
} = await import(LIB);

// ── primitives ────────────────────────────────────────────────────────────────
check(median([2, 1, 3]) === 2, `median([2,1,3]) should be 2, got ${median([2, 1, 3])}`);
check(median([1, 2, 3, 4]) === 2.5, `median([1,2,3,4]) should be 2.5, got ${median([1, 2, 3, 4])}`);

// σ floors at 5% — a dead-quiet window (all identical) must not collapse the noise band to 0,
// which would make the wire == locked_ratio and let any float wobble freeze the repo.
check(
  Math.abs(rollingSigma([1.0, 1.0, 1.0, 1.0]) - 0.05) < 1e-12,
  `rollingSigma of a flat window must floor at 0.05, got ${rollingSigma([1.0, 1.0, 1.0, 1.0])}`,
);
// a genuinely noisy window must report σ ABOVE the floor (the band widens with real noise).
check(rollingSigma([1.0, 1.3, 0.7, 1.1, 0.9]) > 0.05, "a noisy window must report σ above the 5% floor");

// wire = locked_ratio × (1 + 3σ); win = locked_ratio × (1 − 3σ); separated by the full 3σ band.
{
  const locked = 1.0, sigma = 0.05;
  check(Math.abs(regressionWire(locked, sigma) - 1.15) < 1e-9, `wire = 1.0×(1+3·0.05)=1.15, got ${regressionWire(locked, sigma)}`);
  check(Math.abs(winThreshold(locked, sigma) - 0.85) < 1e-9, `win = 1.0×(1−3·0.05)=0.85, got ${winThreshold(locked, sigma)}`);
  check(regressionWire(locked, sigma) > winThreshold(locked, sigma), "wire must sit strictly above the win threshold (>noise separation)");
}

// ── (a) CONFIRMED regression → red ──────────────────────────────────────────────
// locked=1.00, σ=0.05 → wire=1.15. Two injected 3-run medians both at 1.30 (> wire): the
// confirmatory re-run reproduces, so this is a real sustained regression → red + frozen.
{
  const r = evaluateRegression({ locked_ratio: 1.0, sigma: 0.05, samples: [1.3, 1.3] });
  check(r.red === true, "(a) two medians above the wire must be RED (confirmed regression)");
  check(r.confirmed === true, "(a) a two-sample breach must be marked confirmed");
}

// ── (b) single noise-band blip → NOT red (the anti-deadlock property) ───────────
// First median 1.30 pokes above the 1.15 wire, but the CONFIRMATORY re-run comes back at 1.02
// (inside the band). A single outlier must NEVER freeze the repo — this is the whole point of the
// confirm-before-freeze rule; without it, one flaky nightly deadlocks all merges.
{
  const r = evaluateRegression({ locked_ratio: 1.0, sigma: 0.05, samples: [1.3, 1.02] });
  check(r.red === false, "(b) a lone blip whose re-run returns inside the band must NOT be red (anti-deadlock)");
  check(r.confirmed === false, "(b) an unconfirmed blip must not be marked confirmed");
}
// and the dual control: a single sample above the wire with NO confirmatory re-run yet is
// pending, never an instant freeze.
{
  const r = evaluateRegression({ locked_ratio: 1.0, sigma: 0.05, samples: [1.3] });
  check(r.red === false, "(b) one sample and no re-run yet must not freeze — it is pending confirmation");
}

// ── (c) win locks only after 3 improving nightlies, at the WORSE end ────────────
// locked=1.00, σ=0.05 → win threshold=0.85. Three consecutive nightly medians all beat it:
// [0.80, 0.70, 0.60]. The lock must be the CONSERVATIVE (worst = largest) of the improving
// window = 0.80, NOT the best-ever 0.60. Locking 0.60 would set an unachievable floor that a
// normal 0.80-ish run instantly regresses against.
{
  const w = evaluateWinLock({ locked_ratio: 1.0, sigma: 0.05, nightlyMedians: [0.8, 0.7, 0.6] });
  check(w.lock === true, "(c) three consecutive medians below the win threshold must lock a win");
  check(Math.abs(w.new_locked_ratio - 0.8) < 1e-9, `(c) the win must lock the WORSE end (0.80), not best-ever 0.60; got ${w.new_locked_ratio}`);
  check(w.new_locked_ratio < 1.0, "(c) locked_ratio must have decreased");
}
// only 2 improving nightlies (the third is inside the band) → NO lock yet.
{
  const w = evaluateWinLock({ locked_ratio: 1.0, sigma: 0.05, nightlyMedians: [0.8, 0.7, 0.90] });
  check(w.lock === false, "(c) a win needs 3 CONSECUTIVE improving nightlies — 2 is not enough");
}
// locked_ratio only ever DECREASES: a window of worse (larger) medians must never raise the lock.
{
  const w = evaluateWinLock({ locked_ratio: 0.8, sigma: 0.05, nightlyMedians: [0.9, 0.95, 0.92] });
  check(w.lock === false, "(c) locked_ratio may only decrease — a worse window must never re-lock upward");
}

// ── (d) a loosening hand-edit is detectable (integrity chain) ───────────────────
// sealSuite() stamps a suite entry with an integrity digest over its (metric, locked_ratio, σ
// window). verifyLedger() recomputes and must catch a hand-edit that loosens locked_ratio
// (raises it, so a slow run passes) without re-sealing.
{
  const suite = sealSuite({
    suite: "cli/glob", metric: "wall-clock", locked_ratio: 1.0, sigma_window: [0.04, 0.05, 0.03],
  });
  // a well-formed sealed suite verifies clean.
  const clean = verifyLedger({ suites: [suite] });
  check(clean.ok === true, `(d) a freshly sealed suite must verify clean; errors: ${JSON.stringify(clean.errors)}`);

  // the attack: loosen the lock 1.0 → 1.5 (a slower run now passes) but keep the old digest.
  const tampered = { ...suite, locked_ratio: 1.5 };
  const caught = verifyLedger({ suites: [tampered] });
  check(caught.ok === false, "(d) a loosening hand-edit (locked_ratio raised, digest stale) must be DETECTED");
  check(
    caught.errors.some((e) => /cli\/glob/.test(e) && /integrity|digest|chain|seal/i.test(e)),
    `(d) the detection must name the suite and the integrity break; errors: ${JSON.stringify(caught.errors)}`,
  );
}

// ── empty-suite guard: no locks yet → verify passes trivially (never blocks bootstrap) ──
{
  const empty = verifyLedger({ suites: [] });
  check(empty.ok === true, "empty suite set (no locks yet) must verify trivially (bootstrap must never block)");
}

if (fails.length) {
  for (const f of fails) console.error("FAIL ratchet-math: " + f);
  process.exit(1);
}
console.log("PASS ratchet-math (all 4 §9.1 ratchet properties + primitives + empty-suite guard)");
