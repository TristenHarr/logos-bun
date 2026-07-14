// fuzz/semver/bun-hunt — hunt bun's OWN Bun.semver for bugs by differentially
// fuzzing Bun.semver.satisfies against node-semver (the reference our LOGOS port
// already matches over ~50k pairs). Any (version, range) where Bun.semver
// disagrees with node-semver on VALID input is a candidate BUN bug (BUG-12 is
// one such). Runs the whole corpus through the oracle bun binary in ONE --eval.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import semver from "semver";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUN = join(ROOT, "vendor-artifacts", "oracle-bun", "bun");

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seed = Number(process.argv[2] || 20260714);
const n = Number(process.argv[3] || 4000);
const rnd = mulberry32(seed);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const comp = () => (rnd() < 0.5 ? Math.floor(rnd() * 4) : Math.floor(rnd() * 20));
const preTag = () => pick(["alpha", "alpha.1", "beta.2", "rc.1", "0"]);
const triple = () => [comp(), comp(), comp()];
const wild = () => pick(["x", "*"]);
const partial = (b) => pick([`${b[0]}.${wild()}`, `${b[0]}.${b[1]}.${wild()}`, `${b[0]}`, `${b[0]}.${b[1]}`]);
const rangeFrom = (b) => {
  const s = b.join("."), s2 = [b[0] + 1 + Math.floor(rnd() * 2), comp(), comp()].join(".");
  const p = partial(b);
  const s3 = [b[0] + 2, comp(), comp()].join(".");
  return pick([
    `^${s}`, `~${s}`, `>=${s}`, `>${s}`, `<${s}`, `<=${s}`, `=${s}`, s,
    `>=${s} <${s2}`, `${s} - ${s2}`, `^${s} || ^${s2}`, "*",
    p, `^${p}`, `~${p}`, `>=${p}`, `<${p}`,
    `^${s}-${preTag()}`, `>=${s}-${preTag()}`,
    // BUG-12 family: a conjunct that is a BARE exact version (no operator) — bun
    // has been seen to drop trailing exact conjuncts in a space-joined AND set.
    `>${s} ${s2}`, `>=${s} ${s2}`, `${s} ${s2}`, `<${s3} ${s}`, `>=${s} ${s2} <${s3}`,
    `${s2} >=${s}`, `<=${s3} ${s2} >${s}`,
  ]);
};

// Build a valid corpus (node accepts every entry) so a divergence is a real
// disagreement on valid input, not a parse-tolerance difference.
const cases = [];
let guard = 0;
while (cases.length < n && guard < n * 40) {
  guard++;
  const b = triple();
  const range = rangeFrom(b);
  if (semver.validRange(range) === null) continue;
  let v = [b[0] + Math.floor(rnd() * 3) - 1, comp(), comp()].map((x) => Math.max(0, x)).join(".");
  if (rnd() < 0.35) v += `-${preTag()}`;
  if (!semver.valid(v)) continue;
  cases.push([v, range]);
}

const tmp = join(ROOT, "work", "bun-semver-cases.json");
writeFileSync(tmp, JSON.stringify(cases));
const bunOut = execFileSync(BUN, ["--eval",
  `const cs=require(${JSON.stringify(tmp)});console.log(JSON.stringify(cs.map(([v,r])=>{try{return Bun.semver.satisfies(v,r)}catch(e){return "ERR"}})))`],
  { encoding: "utf8", maxBuffer: 64e6 });
const bun = JSON.parse(bunOut);

const bugs = [];
cases.forEach(([v, r], i) => {
  const ref = semver.satisfies(v, r);
  if (bun[i] !== "ERR" && bun[i] !== ref) bugs.push([v, r, bun[i], ref]);
});

console.log(`Bun.semver hunt @ seed ${seed}, ${cases.length} valid pairs:`);
console.log(`  Bun.semver DISAGREES with node-semver: ${bugs.length}`);
// Deduplicate by range SHAPE (operator structure) so distinct bug classes surface.
const seen = new Set();
for (const [v, r, b, ref] of bugs) {
  const shape = r.replace(/\d+/g, "N");
  if (seen.has(shape)) continue;
  seen.add(shape);
  console.log(`  BUG-CLASS  satisfies(${JSON.stringify(v)}, ${JSON.stringify(r)}) → bun=${b} node=${ref}   [shape ${shape}]`);
}
process.exit(0);
