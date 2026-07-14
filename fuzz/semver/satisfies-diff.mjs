// fuzz/semver/satisfies-diff — differential fuzzer for logos-bun's OWN semver
// `satisfies(version, range)` against node-semver. Sibling of port-diff.mjs
// (which fuzzes compareVersions); this fuzzes the RANGE grammar `bun install`
// resolves against: comparators (> >= < <= =), exact, caret ^, tilde ~, `*`,
// AND (space), OR (||), and hyphen ranges (A - B).
//
// SCOPE: full release-version SemVer ranges over the grammar above. Partial
// x-ranges (1.x, 1.2.x, ^1.x) and the prerelease-VERSION-in-range special rule
// are a later increment; the range generator stays inside the implemented
// grammar and every range is validated with semver.validRange first, so the
// corpus is exactly node-semver's accepted domain for this subset.
//
// The generator DERIVES ranges from a base version and probes with the base and
// small perturbations of it, so a large fraction of pairs land ON the range
// boundary — where off-by-one desugaring bugs (^, ~, <, <=) actually live.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import semver from "semver";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

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

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const satisfiesOurs = (v, r) => {
  const res = spawnSync(OURS, ["__semver-satisfies", v, r], { encoding: "utf8" });
  if (res.status !== 0) return { err: `exit ${res.status}: ${(res.stderr || "").trim()}` };
  const out = (res.stdout || "").trim();
  if (out === "true") return { val: true };
  if (out === "false") return { val: false };
  return { err: `non-bool stdout ${JSON.stringify(res.stdout)}` };
};

if (OURS) {
  const seed = Number(process.argv[2] || 20260714);
  const n = Number(process.argv[3] || 600);
  const rnd = mulberry32(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const comp = () => {
    const k = rnd();
    if (k < 0.4) return Math.floor(rnd() * 3);   // 0,1,2 — the caret/tilde zero edges
    if (k < 0.7) return 9 + Math.floor(rnd() * 3); // 9,10,11 — digit-width edge
    return Math.floor(rnd() * 30);
  };
  const triple = () => [comp(), comp(), comp()];
  const str = (t) => t.join(".");
  // A small perturbation of a base triple: ±1 on one component, or a bump that
  // crosses a range boundary (so both satisfy and just-miss cases are dense).
  const perturb = (t) => {
    const c = [...t];
    const i = Math.floor(rnd() * 3);
    const d = pick([-1, 0, 1, 1]);
    c[i] = Math.max(0, c[i] + d);
    return c;
  };
  const wildTail = pick(["x", "X", "*"]);
  // A partial (x-range) form of a base: `1.x`, `1.2.x`, `1`, `1.2`.
  const partial = (base) => pick([
    `${base[0]}.${wildTail}`, `${base[0]}.${base[1]}.${wildTail}`,
    `${base[0]}`, `${base[0]}.${base[1]}`,
  ]);
  // A valid prerelease tag (node-accepted): triggers the §11-in-range special rule.
  const preTag = () => pick(["alpha", "alpha.1", "beta.2", "rc.1", "0", "pre.3"]);
  // Build a range from a base triple, inside the implemented grammar.
  const rangeFrom = (base) => {
    const b = str(base);
    const b2 = str([base[0] + 1 + Math.floor(rnd() * 2), comp(), comp()]);
    const px = partial(base);
    switch (pick(["caret", "tilde", "gt", "gte", "lt", "lte", "eq", "exact",
                  "and", "hyphen", "or", "star",
                  "xbare", "xcaret", "xtilde", "xgte", "xgt", "xlt", "xlte",
                  "pcaret", "pgte", "pand"])) {
      case "caret": return `^${b}`;
      case "tilde": return `~${b}`;
      case "gt": return `>${b}`;
      case "gte": return `>=${b}`;
      case "lt": return `<${b}`;
      case "lte": return `<=${b}`;
      case "eq": return `=${b}`;
      case "exact": return b;
      case "and": return `>=${b} <${b2}`;
      case "hyphen": return `${b} - ${b2}`;
      case "or": return `^${b} || ^${b2}`;
      // partial x-ranges (bare + caret/tilde/comparator over a partial)
      case "xbare": return px;
      case "xcaret": return `^${px}`;
      case "xtilde": return `~${px}`;
      case "xgte": return `>=${px}`;
      case "xgt": return `>${px}`;
      case "xlt": return `<${px}`;
      case "xlte": return `<=${px}`;
      // prerelease comparators — the §11-in-range special rule (a comparator's
      // prerelease at the version's own tuple is what lets a prerelease version
      // in). bp shares the base tuple so matching-tuple cases are dense.
      case "pcaret": { const bp = `${b}-${preTag()}`; return `^${bp}`; }
      case "pgte": { const bp = `${b}-${preTag()}`; return `>=${bp}`; }
      case "pand": { const bp = `${b}-${preTag()}`; return `>=${bp} <${b2}`; }
      default: return "*";
    }
  };

  const fixed = [
    ["1.2.3", "^1.0.0"], ["2.0.0", "^1.0.0"], ["1.2.3", "~1.2.0"], ["1.3.0", "~1.2.0"],
    ["1.5.0", ">=1.0.0 <2.0.0"], ["2.0.0", ">=1.0.0 <2.0.0"], ["1.2.3", "1.2.3"],
    ["1.2.4", "1.2.3"], ["1.0.0", "^0.2.3"], ["0.2.5", "^0.2.3"], ["0.3.0", "^0.2.3"],
    ["1.5.0", "^1.0.0 || ^2.0.0"], ["3.5.0", "^1.0.0 || ^2.0.0"], ["1.5.0", "1.2.3 - 2.3.4"],
    ["2.4.0", "1.2.3 - 2.3.4"], ["1.2.3", "*"], ["1.2.3", ">1.2.3"], ["1.2.4", ">1.2.3"],
    ["0.0.1", "^0.0.1"], ["0.0.2", "^0.0.1"], ["0.1.0", "~0.0.5"],
    // BUG-12 REGRESSION LOCK: bun's own Bun.semver drops the trailing exact-version
    // conjunct in `>1.0.0 3.0.0`, wrongly returning true for 2.0.0. Our port (like
    // node-semver) treats it as `>1.0.0 AND =3.0.0` → false. This pin ensures we
    // never replicate bun's bug: node-semver says false, so must we.
    ["2.0.0", ">1.0.0 3.0.0"], ["3.0.0", ">1.0.0 3.0.0"], ["1.5.0", ">1.0.0 3.0.0"],
    // §11-in-range special rule: a prerelease version only satisfies a set that
    // has a prerelease comparator at its own [major,minor,patch] tuple.
    ["1.2.3-alpha", ">1.0.0"], ["1.2.3-alpha", "^1.0.0"], ["1.2.3-alpha", "^1.2.3-alpha"],
    ["1.2.3-beta", "^1.2.3-alpha"], ["1.2.4-alpha", ">=1.2.3-alpha <2.0.0"],
    ["1.2.3-alpha", ">=1.2.3-alpha <2.0.0"], ["1.2.3", "^1.2.3-alpha"],
    ["1.2.3-alpha.2", ">=1.2.3-alpha.1"], ["3.4.5-alpha", "^3.4.5-alpha"],
  ];
  const pairs = [...fixed];
  let guard = 0;
  while (pairs.length < fixed.length + n && guard < (fixed.length + n) * 40) {
    guard++;
    const base = triple();
    const range = rangeFrom(base);
    if (semver.validRange(range) === null) continue;
    let ver = str(pick([base, perturb(base), perturb(perturb(base)), triple()]));
    // ~40% of the time attach a prerelease to the tested version — the trigger
    // for the §11-in-range special rule; the tuple often matches a comparator's.
    if (rnd() < 0.4) ver += `-${preTag()}`;
    if (!semver.valid(ver)) continue;
    pairs.push([ver, range]);
  }

  let checked = 0, sat = 0;
  for (const [v, r] of pairs) {
    const ref = semver.satisfies(v, r);
    const ours = satisfiesOurs(v, r);
    if (ours.err) { fails.push(`satisfies(${v}, "${r}"): ours errored — ${ours.err}`); continue; }
    if (ours.val !== ref) fails.push(`satisfies(${v}, "${r}"): ours=${ours.val} node-semver=${ref}`);
    if (ref) sat++;
    checked++;
  }
  if (!fails.length) {
    console.log(`PASS semver-satisfies: ${checked} pairs agree with node-semver (${sat} satisfied, seed ${seed})`);
  }
}

if (fails.length) {
  for (const f of fails.slice(0, 25)) console.error("FAIL semver-satisfies: " + f);
  if (fails.length > 25) console.error(`… and ${fails.length - 25} more`);
  process.exit(1);
}
