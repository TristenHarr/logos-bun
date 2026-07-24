// fuzz/jsint/closureref — closures over objects/arrays capture by REFERENCE. A function expression /arrow
// baked its captured variables via substitute, and encFn/decFn used chr(2) (the tag-REF byte) as the escape
// for `;`, so a substituted object/array ref (chr(2)+id) was CORRUPTED on decode — the closure couldn't
// even read, let alone mutate, a captured object. Switched the encFn/decFn `;` escape to chr(12) (which
// never appears in a value), so refs survive: a closure now reads and mutates a captured object/array and
// the mutation persists (counter objects, caches, accumulators). This fuzzer captures an object or array in
// a function expression / arrow, mutates it, and checks the persisted state vs Node.
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
    const a = ri(90), b = ri(90);
    const k = ri(5);
    if (k === 0) return `(function(){ const c={v:${a}}; const f=function(){ return c.v }; return f() })()`;
    if (k === 1) return `(function(){ const c={v:${a}}; const f=function(){ c.v=${b} }; f(); return c.v })()`;
    if (k === 2) return `(function(){ let arr=[${a}]; const push=(x)=>{ arr.push(x) }; push(${b}); return arr.join(",") })()`;
    if (k === 3) return `(function(){ const o={n:0}; const inc=function(){ o.n=o.n+1; return o.n }; inc(); return inc() })()`;
    return `(function(){ const cache={}; const set=function(kk,vv){ cache[kk]=vv }; set("x",${a}); set("y",${b}); return cache.x+"|"+cache.y })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-closureref: ${checked} object-closure programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-closureref: " + f); process.exit(1); }
