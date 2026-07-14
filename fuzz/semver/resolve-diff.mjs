// fuzz/semver/resolve-diff — differential fuzzer for logos-bun's semver RESOLVER
// (maxSatisfying / minSatisfying) against node-semver. This is the primitive
// `bun install` uses to pick a concrete version from a registry's list given a
// dependency range. Implemented as a single-pass fold over satisfies (no sort),
// so it also re-exercises the whole satisfies grammar under selection pressure.
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
if (!OURS) fails.push("no logos-bun binary under target/ — build it first");

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ours = (cmd, list, r) => {
  const res = spawnSync(OURS, [cmd, list, r], { encoding: "utf8" });
  return res.status === 0 ? (res.stdout || "").trim() : `ERR:${res.status}`;
};

if (OURS) {
  const seed = Number(process.argv[2] || 20260714);
  const n = Number(process.argv[3] || 400);
  const rnd = mulberry32(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const comp = () => (rnd() < 0.55 ? Math.floor(rnd() * 4) : Math.floor(rnd() * 20));
  const base = () => [comp(), comp(), comp()];
  const preTag = () => pick(["alpha", "beta.2", "rc.1", "0"]);
  const ver = (b) => {
    let v = b.join(".");
    if (rnd() < 0.3) v += `-${preTag()}`;
    return v;
  };
  const rangeFrom = (b) => pick([
    `^${b.join(".")}`, `~${b.join(".")}`, `>=${b.join(".")}`, `>${b[0]}.x`,
    `${b[0]}.x`, `${b[0]}.${b[1]}.x`, "*", `<${b[0] + 2}.0.0`,
    `>=${b.join(".")} <${b[0] + 2}.0.0`,
  ]);

  let checked = 0, hits = 0;
  for (let it = 0; it < n; it++) {
    const b = base();
    const range = rangeFrom(b);
    if (semver.validRange(range) === null) continue;
    // A candidate list clustered around the base (so some satisfy, some don't).
    const k = 2 + Math.floor(rnd() * 8);
    const list = [];
    for (let j = 0; j < k; j++) {
      const c = [b[0] + Math.floor(rnd() * 3) - 1, comp(), comp()].map((x) => Math.max(0, x));
      const v = ver(c);
      if (semver.valid(v)) list.push(v);
    }
    if (!list.length) continue;
    const csv = list.join(",");
    // node-semver refuses a comma in a version, so our CSV split is unambiguous.
    for (const [cmd, fn] of [["__semver-max", "maxSatisfying"], ["__semver-min", "minSatisfying"]]) {
      const ref = semver[fn](list, range) || "";
      const got = ours(cmd, csv, range);
      if (got !== ref) fails.push(`${fn}([${csv}], "${range}"): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
      if (ref) hits++;
    }
    checked++;
  }
  if (!fails.length) console.log(`PASS semver-resolve: ${checked} lists agree with node-semver (${hits} non-empty picks, seed ${seed})`);
}

if (fails.length) {
  for (const f of fails.slice(0, 25)) console.error("FAIL semver-resolve: " + f);
  if (fails.length > 25) console.error(`… and ${fails.length - 25} more`);
  process.exit(1);
}
