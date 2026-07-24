// fuzz/jsint/scalarclosure — a closure that captures a mutable SCALAR. A closure captures free variables by
// value (substitute bakes the current value), so a captured mutable scalar neither wrote its mutations back
// out nor saw later outer updates: `let c=0; const inc=()=>++c; inc(); inc()` left c at 0. Object mutations
// through a closure already worked (shared heap ref), so a captured numeric `let`/`var` scalar is now BOXED
// into a single-field heap object `{v:init}` and every use rewritten to `name.v` — the box is a reference,
// so closure and enclosing scope share it and mutations flow both ways. Exercises increment/compound-assign
// through a stored closure, repeated calls accumulating, outer updates seen by the closure, a boxed number's
// method (`.toFixed`), and a returned closure keeping its box; non-captured scalars, loop accumulators, plain
// calls, and object/method use are re-checked as regressions. Diffed vs Node.
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
    const a = ri(20), b = ri(20), k = ri(12);
    if (k === 0) return `(function(){let c=${a};const inc=()=>++c;inc();inc();return c})()`;
    if (k === 1) return `(function(){let c=${a};function inc(){c++}inc();inc();inc();return c})()`;
    if (k === 2) return `(function(){let c=${a};const inc=()=>{c=c+${b};return c};return inc()+","+inc()})()`;
    if (k === 3) return `(function(){let c=${a};const get=()=>c;c=${b};return get()})()`;
    if (k === 4) return `(function(){let c=${a};const f=()=>c*2;return f()})()`;
    if (k === 5) return `(function(){function mk(){let n=${a};return ()=>++n}const f=mk();f();return f()})()`;
    if (k === 6) return `(function(){let s=${a};[1,2,3].forEach(x=>{s+=x});return s})()`;         // forEach write-back still ok
    if (k === 7) return `(function(){let c=${a};const bump=(d)=>c+=d;bump(${b});bump(1);return c})()`;
    if (k === 8) return `(function(){let x=${a}.5;const f=()=>x;return f().toFixed(1)})()`;         // boxed number method
    if (k === 9) return `(function(){let sum=0;for(let i=1;i<=${1 + a % 5};i++)sum+=i;return sum})()`; // regression: loop accumulator
    if (k === 10) return `(function(){function add(p,q){return p+q}return add(${a},${b})})()`;       // regression: plain call
    return `(function(){let o={c:${a}};const inc=()=>++o.c;inc();inc();return o.c})()`;              // regression: object capture (already worked)
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-scalarclosure: ${checked} scalar-closure programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-scalarclosure: " + f); process.exit(1); }
