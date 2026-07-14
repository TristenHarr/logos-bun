// fuzz/semver/port-diff — differential fuzzer for logos-bun's OWN semver
// `compareVersions` against node-semver (the reference). Sibling of diff.mjs
// (which fuzzes bun-vs-node-semver to find BUN bugs); this one fuzzes
// logos-bun-vs-node-semver to keep OUR port honest.
//
// The port lives in src/main.lg (Ordering + parse + compareVersions), exposed
// through the internal `bun __semver-compare A B` command which prints -1/0/1 —
// exactly node-semver's `compare` codomain. We generate random versions, run
// BOTH engines on each ordered pair, and demand byte agreement on the sign. A
// single disagreement fails the lane.
//
// SCOPE: full SemVer §11 precedence — MAJOR.MINOR.PATCH plus prerelease ORDERING
// (numeric-vs-alphanumeric, numeric-compares-numerically, longer-set-wins) and
// build metadata (ignored). Every generated version is validated with
// semver.valid() first, so the corpus is exactly node-semver's accepted domain.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import semver from "semver";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Locate the freshest logos-bun binary under target/ (built by scripts/build.sh).
function findBin(dir, out = []) {
  let es; try { es = readdirSync(dir); } catch { return out; }
  for (const e of es) {
    const p = join(dir, e); let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) findBin(p, out);
    else if (e === "bun" && st.mode & 0o111) out.push(p);
  }
  return out;
}
const OURS = findBin(join(ROOT, "target"))
  .filter((p) => !/vendor|oracle/.test(p))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];

const fails = [];
if (!OURS) fails.push("no logos-bun binary under target/ — build it first (scripts/build.sh)");

// Deterministic PRNG so a failure reproduces exactly (seed printed on failure).
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const compareOurs = (a, b) => {
  const r = spawnSync(OURS, ["__semver-compare", a, b], { encoding: "utf8" });
  if (r.status !== 0) return { err: `exit ${r.status}: ${(r.stderr || "").trim()}` };
  const n = Number((r.stdout || "").trim());
  return Number.isFinite(n) ? { val: Math.sign(n) } : { err: `non-numeric stdout ${JSON.stringify(r.stdout)}` };
};

if (OURS) {
  const seed = Number(process.argv[2] || 20260713);
  const n = Number(process.argv[3] || 300);
  const rnd = mulberry32(seed);
  // Bias toward the boundaries that break naive (lexicographic) comparators:
  // two-digit vs one-digit components (1.2.10 vs 1.2.9), 0.10 vs 0.9, ties.
  const comp = () => {
    const k = rnd();
    if (k < 0.25) return Math.floor(rnd() * 3);          // 0,1,2 — tie-prone
    if (k < 0.55) return 9 + Math.floor(rnd() * 3);       // 9,10,11 — digit-width edge
    return Math.floor(rnd() * 60);                        // 0..59 — general
  };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  // Prerelease identifiers spanning every §11 rule: alphanumeric words that sort
  // (alpha<beta<rc), numeric ids (which rank BELOW alphanumeric and compare
  // numerically so 2<11), and hyphenated ids (a prerelease may contain `-`).
  const preId = () => pick(["alpha", "beta", "rc", "pre", "dev", "0", "1", "2", "10", "11", "x-1", "a"]);
  const preTag = () => {
    const len = 1 + Math.floor(rnd() * 3);
    return Array.from({ length: len }, preId).join(".");
  };
  const ver = () => {
    let v = `${comp()}.${comp()}.${comp()}`;
    if (rnd() < 0.55) v += `-${preTag()}`;                // prerelease on most versions — the point
    if (rnd() < 0.2) v += `+build.${Math.floor(rnd() * 99)}`; // build metadata (must be ignored)
    return v;
  };

  // Adversarial fixed cases: the lexicographic-vs-numeric traps AND the full
  // SemVer §11 precedence chain (each adjacent pair must order strictly less).
  const fixed = [
    ["1.2.10", "1.2.9"], ["0.10.0", "0.9.0"], ["1.0.0", "1.0.0"],
    ["2.0.0", "10.0.0"], ["1.11.0", "1.9.0"], ["0.10.1", "0.9.17"],
    ["1.0.0-alpha", "1.0.0-alpha.1"], ["1.0.0-alpha.1", "1.0.0-alpha.beta"],
    ["1.0.0-alpha.beta", "1.0.0-beta"], ["1.0.0-beta", "1.0.0-beta.2"],
    ["1.0.0-beta.2", "1.0.0-beta.11"], ["1.0.0-beta.11", "1.0.0-rc.1"],
    ["1.0.0-rc.1", "1.0.0"], ["1.0.0-alpha", "1.0.0"],
    ["1.0.0+build", "1.0.0"], ["1.0.0-x.7.z.92", "1.0.0-x.7.z.92"],
  ];
  const pairs = [...fixed];
  // Only node-VALID versions enter the corpus (else semver.compare throws) —
  // this keeps the domain exactly node-semver's accepted set.
  const genValid = () => { for (;;) { const v = ver(); if (semver.valid(v)) return v; } };
  for (let i = 0; i < n; i++) pairs.push([genValid(), genValid()]);

  let checked = 0;
  for (const [a, b] of pairs) {
    const ref = Math.sign(semver.compare(a, b));
    const ours = compareOurs(a, b);
    if (ours.err) { fails.push(`compare(${a}, ${b}): ours errored — ${ours.err}`); continue; }
    if (ours.val !== ref) fails.push(`compare(${a}, ${b}): ours=${ours.val} node-semver=${ref}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS semver-compare: ${checked} pairs agree with node-semver (seed ${seed})`);
}

if (fails.length) {
  for (const f of fails.slice(0, 20)) console.error("FAIL semver-compare: " + f);
  if (fails.length > 20) console.error(`… and ${fails.length - 20} more`);
  process.exit(1);
}
