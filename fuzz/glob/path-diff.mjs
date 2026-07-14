// fuzz/glob/path-diff — differential fuzzer for logos-bun's MULTI-SEGMENT glob
// (globPath: `**` globstar + `/`-aware segment matching) against minimatch.
// `**` matches zero or more path segments; every other segment matches exactly
// one via the single-segment fnmatch core. Braces `{a,b}` are a later increment.
//
// Excluded (minimatch filesystem rules our matcher intentionally omits): empty
// segments and the `.`/`..` directory entries. minimatch runs {dot:true} so
// `*`/`**` cross dot segments, aligning with our dot-agnostic matcher.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { minimatch } from "minimatch";

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

const MM = { dot: true, nobrace: true, noext: true, nonegate: true, nocomment: true };
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
const ours = (pat, pth) => {
  const r = spawnSync(OURS, ["__glob-path", pat, pth], { encoding: "utf8" });
  return r.status !== 0 ? `ERR:${r.status}` : (r.stdout || "").trim();
};

if (OURS) {
  const seed = Number(process.argv[2] || 20260714);
  const n = Number(process.argv[3] || 800);
  const rnd = mulberry32(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const alpha = "abc12";
  const seg = () => {
    const len = 1 + Math.floor(rnd() * 4);
    let s = Array.from({ length: len }, () => pick(alpha.split(""))).join("");
    return s === "." || s === ".." ? s + "x" : s; // never emit . / ..
  };
  const path = () => Array.from({ length: 1 + Math.floor(rnd() * 3) }, seg).join("/");
  // A pattern derived from a path: per segment keep / *,? / [class] / ** ; plus
  // occasional inserted ** and fully-random miss patterns.
  const patSeg = (s) => {
    const k = rnd();
    if (k < 0.2) return "*";
    if (k < 0.3) return "**";
    if (k < 0.4) return s.length ? "?" + s.slice(1) : "*";
    if (k < 0.5) return `[${pick(["a-c", "1-2", "abc"])}]${s.slice(1)}`;
    return s;
  };
  const patFrom = (p) => {
    const segs = p.split("/").map(patSeg);
    if (rnd() < 0.3) segs.splice(Math.floor(rnd() * (segs.length + 1)), 0, "**");
    return segs.join("/");
  };

  const fixed = [
    ["a/**/c", "a/c"], ["a/**/c", "a/b/c"], ["a/**/c", "a/b/d/c"], ["a/*/c", "a/b/d/c"],
    ["**", "a/b/c"], ["**/c", "a/b/c"], ["a/**", "a/b/c"], ["src/**/*.ts", "src/a/b.ts"],
    ["*/b", "a/b"], ["a/b/c", "a/b/c"],
  ];
  let checked = 0, hit = 0;
  for (const [p, t] of fixed) {
    const ref = String(minimatch(t, p, MM)); const got = ours(p, t);
    if (got !== ref) fails.push(`globPath("${p}", "${t}"): ours=${got} minimatch=${ref}`);
    checked++;
  }
  for (let i = 0; i < n; i++) {
    const t = path();
    const p = rnd() < 0.85 ? patFrom(t) : Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => pick(["*", "**", seg(), "?" + seg()])).join("/");
    if (!p || !t) continue;
    const ref = String(minimatch(t, p, MM));
    const got = ours(p, t);
    if (got !== ref) fails.push(`globPath("${p}", "${t}"): ours=${got} minimatch=${ref}`);
    if (ref === "true") hit++;
    checked++;
  }
  if (!fails.length) console.log(`PASS glob-path: ${checked} pairs agree with minimatch (${hit} matched, seed ${seed})`);
}

if (fails.length) {
  for (const f of fails.slice(0, 25)) console.error("FAIL glob-path: " + f);
  if (fails.length > 25) console.error(`… and ${fails.length - 25} more`);
  process.exit(1);
}
