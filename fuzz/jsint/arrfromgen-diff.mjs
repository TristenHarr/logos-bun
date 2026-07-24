// fuzz/jsint/arrfromgen — Array.from over a generator (and any object without a `length`). `Array.from(g())`
// on a generator PANICKED the engine ("Cannot parse 'undefined' as Int") — arrFromBase had no generator
// branch and fell through to `parseInt(obj.length)` with length undefined. Now arrFromBase iterates a
// generator via the same collected-yields path as for-of/spread, and any length-less object yields an empty
// array instead of panicking. Exercises Array.from on generators (empty, several yields, with a map fn) plus
// arrays/strings/Sets/Maps/array-likes as regressions. Diffed vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const run = (p) => { const r = spawnSync(OURS, ["__js", p], { encoding: "utf8" }); return r.status !== 0 ? `ERR:${r.status}` : (r.stdout || "").replace(/\n$/, ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 200), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = ri(30), b = ri(30), c = ri(30), k = ri(9);
    if (k === 0) return `(function(){function* g(){yield ${a};yield ${b}}return Array.from(g()).join(",")})()`;
    if (k === 1) return `(function(){function* g(){yield ${a};yield ${b};yield ${c}}return Array.from(g()).length})()`;
    if (k === 2) return `(function(){function* g(){yield ${a};yield ${b}}return Array.from(g(),x=>x*2).join(",")})()`;
    if (k === 3) return `(function(){function* g(){}return Array.from(g()).length})()`;                          // empty generator
    if (k === 4) return `(function(){function* r(m){for(let i=0;i<m;i++)yield i*i}return Array.from(r(${1 + (a % 5)})).join(",")})()`;
    if (k === 5) return `(function(){return Array.from([${a},${b},${c}]).join(",")})()`;                          // regression: array
    if (k === 6) return `(function(){return Array.from("ab${a % 10}").join("-")})()`;                             // regression: string
    if (k === 7) return `(function(){return Array.from(new Set([${a},${a},${b}])).length})()`;                    // regression: Set
    return `(function(){return Array.from({length:${a % 5}},(_, i)=>i).join(",")})()`;                            // regression: array-like
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-arrfromgen: ${checked} Array.from programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-arrfromgen: " + f); process.exit(1); }
