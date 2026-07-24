// fuzz/jsint/forletclosure — a `for (let i …)` loop variable is a FRESH per-iteration binding, so a closure
// created in the body captures that iteration's value: `for(let i=0;i<3;i++) fns.push(()=>i)` must give
// 0,1,2, not the final 3,3,3. The loop var's current value is now baked into the body before each iteration
// when the body contains a closure and the var is `let`/`const`; `var` (function-scoped, shared) stays
// 3,3,3, and closure-free bodies are untouched. Exercises the arrow and function-expression closure forms,
// a scaled capture, nested loops, and a labeled `var` control; accumulators, index-pushes, and products are
// regressions. Diffed vs Node.
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
    const m = 2 + ri(4), a = 1 + ri(6), k = ri(10);
    if (k === 0) return `(function(){const fns=[];for(let i=0;i<${m};i++)fns.push(()=>i);return fns.map(f=>f()).join(",")})()`;
    if (k === 1) return `(function(){const fns=[];for(let i=0;i<${m};i++){fns.push(()=>i)}return fns.map(f=>f()).join(",")})()`;
    if (k === 2) return `(function(){const fns=[];for(let i=0;i<${m};i++)fns.push(()=>i*${a});return fns.map(f=>f()).join(",")})()`;
    if (k === 3) return `(function(){const a=[];for(let i=0;i<${m};i++)a.push(function(){return i});return a.map(f=>f()).join(",")})()`;
    if (k === 4) return `(function(){const fns=[];for(var i=0;i<${m};i++)fns.push(()=>i);return fns.map(f=>f()).join(",")})()`; // var: shared
    if (k === 5) return `(function(){let s="";for(let i=0;i<${m};i++)for(let j=0;j<2;j++)s+=i+""+j;return s})()`;               // nested loops
    if (k === 6) return `(function(){let sum=0;for(let i=0;i<${m};i++)sum+=i;return sum})()`;                                    // regression: accumulator
    if (k === 7) return `(function(){const r=[];for(let i=0;i<${m};i++)r.push(i*${a});return r.join(",")})()`;                   // regression: index push
    if (k === 8) return `(function(){let p=1;for(let i=1;i<=${m};i++)p*=i;return p})()`;                                         // regression: product
    return `(function(){let c=0;for(let i=0;i<${m + 3};i++){if(i%2===0)c++}return c})()`;                                        // regression: conditional count
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-forletclosure: ${checked} for-let-closure programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-forletclosure: " + f); process.exit(1); }
