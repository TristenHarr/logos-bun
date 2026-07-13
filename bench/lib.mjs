// bench/lib — the never-slower ratchet MATH (BAKE_A_BUN §9.1). Pure, deterministic, and
// I/O-free so the RED battery can drive it with injected 3-run medians (hyperfine never runs in
// a test). run.mjs feeds it real medians; verify.mjs / gate L12 uses its integrity seal.
//
// The whole design serves one invariant §9.1 spells out: NOISE CANNOT DEADLOCK THE RATCHET. Two
// thresholds bracket every locked_ratio, separated by the full 3σ noise band —
//   Regression wire = locked_ratio × (1 + 3σ)   (freeze only ABOVE it, and only after a
//                                                 confirmatory re-run also exceeds it)
//   Win threshold   = locked_ratio × (1 − 3σ)   (re-lock only when 3 consecutive nightlies all
//                                                 beat it, locking the CONSERVATIVE end)
// — so a steady-state run lands between them with margin, and locked_ratio only ever decreases.
//
// FOUR metric kinds ride this identical arithmetic: wall-clock, peak-rss, binary-size (the
// shipped `bun`), and build-time (logos-bun's own `largo build`, the G11 evidence stream).
// npm-world tooling per CLAUDE.md R3; its RED drivers are shims allowlisted → W2.9.
import { chainDigest, GENESIS, sha256Hex } from "../scripts/lints/ledger-lint.mjs";

// re-export the shared chain primitives so run.mjs / verify.mjs seal against the same core.
export { chainDigest, GENESIS, sha256Hex };

// the noise floor and the wire/win half-width, both in §9.1's language (3σ, σ≥5%).
export const SIGMA_FLOOR = 0.05;
export const SIGMA_K = 3; // the "3" in 3σ — the band half-width in σ units
export const WIN_STREAK = 3; // consecutive improving nightlies required to re-lock
export const METRIC_KINDS = ["wall-clock", "peak-rss", "binary-size", "build-time"];

// ── primitives ──────────────────────────────────────────────────────────────
// median of a run set (the §9.1 "3-run median" — general n, even-n = mean of the middle pair).
export function median(nums) {
  if (!Array.isArray(nums) || nums.length === 0) throw new Error("median: empty sample set");
  const s = [...nums].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// rolling per-suite noise σ = population relative standard deviation of the window, FLOORED at
// 5%. The floor is load-bearing: a dead-quiet window would otherwise collapse the band to 0,
// making wire == locked_ratio, so any float wobble freezes the repo. σ is expressed RELATIVE to
// the window mean because the thresholds are multiplicative (locked_ratio × (1 ± 3σ)).
export function rollingSigma(window) {
  if (!Array.isArray(window) || window.length < 2) return SIGMA_FLOOR;
  const mean = window.reduce((a, b) => a + b, 0) / window.length;
  if (mean <= 0) return SIGMA_FLOOR;
  const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length;
  const rel = Math.sqrt(variance) / mean;
  return Math.max(SIGMA_FLOOR, rel);
}

// the two thresholds, deliberately separated by the full 2·(3σ) band around locked_ratio.
export function regressionWire(lockedRatio, sigma) {
  return lockedRatio * (1 + SIGMA_K * sigma);
}
export function winThreshold(lockedRatio, sigma) {
  return lockedRatio * (1 - SIGMA_K * sigma);
}

// ── (a)/(b) the regression wire: confirm-before-freeze ────────────────────────
// `samples` are successive 3-run MEDIANS on the same shard (attempt 1, then the confirmatory
// re-run attempt 2). RED requires BOTH to exceed the wire: a lone outlier (attempt 1 above,
// attempt 2 back inside the band) is never a freeze — that is the anti-deadlock property. One
// sample with no re-run yet is `pending`, never red.
export function evaluateRegression({ locked_ratio, sigma, samples }) {
  const wire = regressionWire(locked_ratio, sigma);
  const above = samples.map((m) => m > wire);
  if (above.length === 0 || !above[0]) return { red: false, confirmed: false, pending: false, wire };
  if (above.length < 2) return { red: false, confirmed: false, pending: true, wire }; // awaiting confirm
  const confirmed = above[0] && above[1];
  return { red: confirmed, confirmed, pending: false, wire };
}

// ── (c) the win lock: 3 improving nightlies, conservative end, monotone-down ───
// `nightlyMedians` are the last N nightly 3-run medians (chronological). A win locks iff the
// last WIN_STREAK are ALL below the win threshold; the new lock is the CONSERVATIVE (worst =
// LARGEST) of that improving window — never the best-ever sample — and locked_ratio only ever
// decreases (a worse window can never re-lock upward).
export function evaluateWinLock({ locked_ratio, sigma, nightlyMedians }) {
  const win = winThreshold(locked_ratio, sigma);
  if (!Array.isArray(nightlyMedians) || nightlyMedians.length < WIN_STREAK)
    return { lock: false, win, reason: `need ${WIN_STREAK} consecutive nightlies, have ${nightlyMedians ? nightlyMedians.length : 0}` };
  const streak = nightlyMedians.slice(-WIN_STREAK);
  if (!streak.every((m) => m < win))
    return { lock: false, win, reason: `the last ${WIN_STREAK} medians are not all below the win threshold ${win}` };
  const conservative = Math.max(...streak); // worst end of the improving window
  const next = Math.min(locked_ratio, conservative); // locked_ratio only decreases
  if (!(next < locked_ratio)) return { lock: false, win, reason: "conservative end does not improve on the current lock" };
  return { lock: true, new_locked_ratio: next, win, conservative };
}

// ── the integrity seal: a loosening hand-edit must be visible ─────────────────
// A suite entry is sealed with a chain digest over its canonical (suite, metric, locked_ratio,
// σ-window, baseline) body, using the SAME chainDigest/GENESIS core as the conformance ledger.
// verifyLedger() recomputes and rejects any body whose stored digest is stale — the exact shape
// a hand-edit that RAISES locked_ratio (loosening the lock so a slower run passes) produces.
function suiteBody(s) {
  // canonical, order-stable serialization of the SEALED fields (never the digest itself).
  const obj = {
    suite: s.suite,
    metric: s.metric,
    locked_ratio: s.locked_ratio ?? null,
    sigma_window: s.sigma_window ?? [],
    baseline_seconds: s.baseline_seconds ?? null,
    baseline_bytes: s.baseline_bytes ?? null,
  };
  return JSON.stringify(obj);
}
export function suiteDigest(s) {
  return chainDigest(GENESIS, suiteBody(s));
}
export function sealSuite(s) {
  return { ...s, integrity: suiteDigest(s) };
}

// verify a whole bench LEDGER doc. Empty-suite guard: no locks yet → { ok:true } trivially, so
// the gate never blocks the honest bootstrap state. Otherwise every sealed suite's digest is
// recomputed; a stale digest (loosening edit) is reported by name + kind.
export function verifyLedger(doc) {
  const errors = [];
  const suites = (doc && doc.suites) || [];
  for (const s of suites) {
    if (!METRIC_KINDS.includes(s.metric)) errors.push(`suite ${s.suite}: unknown metric kind "${s.metric}"`);
    if (s.locked_ratio != null && !(s.locked_ratio > 0)) errors.push(`suite ${s.suite}: locked_ratio must be positive`);
    if (typeof s.integrity !== "string" || s.integrity.length !== 64) {
      errors.push(`suite ${s.suite}: missing/short integrity seal`);
      continue;
    }
    const want = suiteDigest(s);
    if (want !== s.integrity)
      errors.push(`suite ${s.suite} (${s.metric}): integrity seal MISMATCH — the digest is stale (a hand-edit loosened locked_ratio or the σ-window without re-sealing)`);
  }
  return { ok: errors.length === 0, errors };
}
