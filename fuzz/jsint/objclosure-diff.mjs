// fuzz/jsint/objclosure — a closure INLINE in an object literal that ESCAPES its defining scope (returned
// from a factory). Such a closure was converted to a function value BEFORE substitute ran, so its captured
// free variables were left as unresolved names and read NaN once the object left the scope:
// `function mk(){ let o={n:0}; return { inc: () => ++o.n } }; mk().inc()` was NaN. An inline `function`
// literal in OBJECT-PROPERTY position (the token before it is `:`) now bakes its captures with the defining
// env, while a sync callback (`map(function…)`, preceded by a method name, consumed in place) is left
// un-baked so it keeps resolving names against the live handle. Exercises the module/factory pattern
// (counter, adder), a getter over a captured var, a captured object mutated through the escaped closure, and
// per-instance capture; same-scope object closures, `this`-methods, and sync callbacks are regressions.
// Diffed vs Node.
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
    const a = ri(20), b = ri(20), k = ri(11);
    if (k === 0) return `(function(){function mk(){let o={n:${a}};return {inc:()=>++o.n}}const x=mk();x.inc();return x.inc()})()`;
    if (k === 1) return `(function(){function mk(){let x=${a};return {get:()=>x}}return mk().get()})()`;
    if (k === 2) return `(function(){function adder(n){return {add:(x)=>x+n}}return adder(${a}).add(${b})})()`;
    if (k === 3) return `(function(){function counter(){let n=${a};return {inc:()=>++n,get:()=>n}}const c=counter();c.inc();c.inc();return c.get()})()`;
    if (k === 4) return `(function(){function mk(){let o={n:${a}};return {inc:function(){return ++o.n}}}const x=mk();x.inc();return x.inc()})()`;
    if (k === 5) return `(function(){function make(m){return {scale:(x)=>x*m}}const d=make(${1 + a % 4});const t=make(${1 + b % 4});return d.scale(2)+","+t.scale(2)})()`;
    if (k === 6) return `(function(){let o={n:${a}};const r={inc:()=>++o.n};r.inc();return r.inc()})()`;            // regression: same-scope object closure
    if (k === 7) return `(function(){const o={v:${a},get(){return this.v}};return o.get()})()`;                     // regression: this-method
    if (k === 8) return `(function(){let arr=[${a},${b}];return [0,1].map(function(i){return arr[i]}).join(",")})()`; // regression: sync callback (unbaked)
    if (k === 9) return `(function(){return [1,2,3].map(x=>x+${a}).reduce((s,v)=>s+v,0)})()`;                       // regression: chained callbacks
    return `(function(){function add(p,q){return p+q}return add(${a},${b})})()`;                                    // regression: plain call
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-objclosure: ${checked} escaping-object-closure programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-objclosure: " + f); process.exit(1); }
