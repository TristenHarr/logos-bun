// Structure-aware semver fuzz generator: emits random (version, range) pairs biased toward
// the edge cases where implementations disagree (prereleases, wildcards, hyphen/partial ranges,
// compound unions). Seeded (deterministic) so any disagreement reproduces. See PROBE.md.
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const PRE = ["alpha", "beta", "rc", "0", "1", "pre", "a", "next", "alpha.1", "rc.0", "0.0", "beta.2", "dev"];
const OPS = ["", "^", "~", ">=", "<=", ">", "<", "=", "v"];
const WILD = ["x", "X", "*"];

export function gen(seed, n) {
  const r = mulberry32(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const num = () => Math.floor(r() * (r() < 0.7 ? 5 : 40));
  const ver = (allowPre = true) => {
    let v = `${num()}.${num()}.${num()}`;
    if (allowPre && r() < 0.5) v += `-${pick(PRE)}`;
    if (r() < 0.15) v += `+${pick(["build", "sha.1", "20130313"])}`;
    return v;
  };
  const part = () => { // partial version, maybe with wildcard
    const segs = [num(), r() < 0.5 ? num() : pick(WILD), r() < 0.4 ? num() : (r() < 0.5 ? pick(WILD) : undefined)];
    let s = String(segs[0]);
    if (segs[1] !== undefined) s += "." + segs[1];
    if (segs[2] !== undefined) s += "." + segs[2];
    if (r() < 0.3) s += `-${pick(PRE)}`;
    return s;
  };
  const simple = () => { const op = pick(OPS); return op + (r() < 0.6 ? ver() : part()); };
  const range = () => {
    const k = r();
    if (k < 0.25) return `${part()} - ${part()}`;                 // hyphen
    if (k < 0.5) return `${simple()} ${simple()}`;                // AND (space)
    if (k < 0.7) return `${simple()} || ${simple()}`;             // OR
    if (k < 0.8) return pick(["*", "", "latest", "x", ">", "<0.0.0-0"]); // weird
    return simple();                                              // single
  };
  const out = [];
  for (let i = 0; i < n; i++) out.push([ver(), range()]);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 10000);
  process.stdout.write(JSON.stringify(gen(seed, n)));
}
