// fuzz/jsint/hofclosure — a higher-order function that RETURNS a closure which CAPTURES and CALLS a
// function-valued parameter: compose, curry, wrap, twice, pipe, hof. These broke because a function value
// is an opaque `chr1 encFn(param) chr1 encFn(body)` token, and when one is baked into another closure's
// body the outer decFn decoded the INNER token's control bytes too (its chr16 → a real space), splitting
// the token so resolveCalls no longer saw it as callable. encFn now escapes pre-existing control bytes
// (chr9 prefix) so decFn leaves nested tokens intact at any depth. Exercises 1/2/3-level capture-and-call
// plus point-free composition; scalar-only closures and same-scope calls are regressions. Diffed vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 260), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = 1 + ri(9), b = 1 + ri(9), x = 1 + ri(20), k = ri(9);
    if (k === 0) return `let f=fn=>y=>fn(y);f(v=>v*${a})(${x})`;
    if (k === 1) return `let make=fn=>()=>fn(${x});make(v=>v+${a})()`;
    if (k === 2) return `let compose=(f,g)=>y=>f(g(y));compose(v=>v+${a},v=>v*${b})(${x})`;
    if (k === 3) return `let curry=fn=>p=>q=>fn(p,q);let add=curry((p,q)=>p+q);add(${a})(${b})`;
    if (k === 4) return `let twice=fn=>y=>fn(fn(y));twice(v=>v+${a})(${x})`;
    if (k === 5) return `let pipe=(...fns)=>y=>fns.reduce((v,f)=>f(v),y);pipe(v=>v+${a},v=>v*${b})(${x})`;
    if (k === 6) return `function hof(fn){return function(y){return fn(y)+${a}}}hof(v=>v*${b})(${x})`;
    if (k === 7) return `let mk=x=>()=>x;mk(${x})()`;                          // regression: scalar capture
    return `let apply=(fn,z)=>fn(z);apply(v=>v+${a},${x})`;                    // regression: same-scope call
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String((0, eval)(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-hofclosure: ${checked} HOF-closure programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-hofclosure: " + f); process.exit(1); }
