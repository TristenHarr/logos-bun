// fuzz/jsint/weakmap — WeakMap/WeakSet (backed by the Map/Set machinery, since our objects are heap refs
// whose ref string IS their identity) plus object-KEY IDENTITY in Map/Set. Two things: (1) `new WeakMap`/
// `new WeakSet` were unimplemented (get/has → NaN); routed to the Map/Set constructors. (2) mapKeyIdx
// compared materialize()d keys, so two distinct `{}` both became "[object Object]" and collapsed to ONE
// key — Map/Set/WeakMap with object keys were broken. Fixed: object/array keys (heap refs) compare by
// reference identity (raw ref string carries a unique id), primitives still by value. Exercises distinct-
// object keys, same-object round-trips, delete, WeakMap-as-memo-cache, and primitive Map/Set regressions,
// diffed vs Node.
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
    const v1 = ri(100), v2 = ri(100);
    const k = ri(8);
    if (k === 0) return `(function(){const wm=new WeakMap();const a={},b={};wm.set(a,${v1});wm.set(b,${v2});return wm.get(a)+"/"+wm.get(b)})()`;
    if (k === 1) return `(function(){const wm=new WeakMap();const a={};wm.set(a,${v1});return wm.has(a)+"/"+wm.get(a)})()`;
    if (k === 2) return `(function(){const ws=new WeakSet();const a={},b={};ws.add(a);ws.add(b);return ws.has(a)+"/"+ws.has(b)+"/"+ws.has({})})()`;
    if (k === 3) return `(function(){const wm=new WeakMap();const a={};wm.set(a,${v1});wm.delete(a);return wm.has(a)})()`;
    if (k === 4) return `(function(){const m=new Map();const a={},b={};m.set(a,${v1});m.set(b,${v2});return m.get(a)+"/"+m.get(b)+"/"+m.size})()`;
    if (k === 5) return `(function(){const s=new Set();const a={},b={};s.add(a);s.add(b);s.add(a);return s.size})()`;
    if (k === 6) return `(function(){const cache=new WeakMap();function f(o){if(cache.has(o))return cache.get(o);const r=o.n*${1 + ri(5)};cache.set(o,r);return r}const o={n:${v1}};return f(o)+"/"+f(o)})()`;
    // primitive-key Map regression (must stay correct)
    return `(function(){const m=new Map();m.set("k${v1}",${v1});m.set("k${v2}",${v2});return m.get("k${v1}")+"/"+m.size})()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-weakmap: ${checked} WeakMap/WeakSet + object-key-identity programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-weakmap: " + f); process.exit(1); }
