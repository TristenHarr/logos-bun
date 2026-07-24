// fuzz/jsint/bindfn — Function.prototype.bind. `f.bind(o)` was unimplemented. Now it returns a plain
// object carrying the original function, the bound `this` (`__bfn`/`__bthis`), and any bound leading
// arguments (`__bargs`), and the call dispatch re-routes an invocation of that object through callMethod
// with the bound `this` and the bound args PREPENDED to the call's own args — reached whether the bound
// value is called immediately (`f.bind(o)()`) or through a variable (`const g=f.bind(o,5); g(3)`), and
// callMethod also binds `arguments`, so a bound `this`-using function works. Exercises `this` access,
// bound PARTIAL args (`add.bind(null,5)`), partial + `this`, string partials, reuse across calls,
// arguments after bind, immediate vs stored bind, and method binding (`obj.m.bind(obj)`); plain calls and
// call/apply are re-checked as regressions. (Passing a bound fn as a map callback is a separate follow-up
// and avoided here.) Diffed vs Node.
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
    const t = ri(50), a = ri(50), b = ri(50), k = ri(11);
    if (k === 0) return `(function(){const o={x:${t}};function f(){return this.x};return f.bind(o)()})()`;
    if (k === 1) return `(function(){const o={n:${t}};function f(p){return this.n+p};const g=f.bind(o);return g(${a})})()`;
    if (k === 2) return `(function(){const o={n:${t}};function f(p,q){return this.n+p+q};const g=f.bind(o);return g(${a},${b})})()`;
    if (k === 3) return `(function(){const obj={x:${t},getX(){return this.x}};const g=obj.getX.bind(obj);return g()})()`;
    if (k === 4) return `(function(){function f(){let s=0;for(let i=0;i<arguments.length;i++)s+=arguments[i];return s};const g=f.bind(null);return g(${a},${b})})()`;
    if (k === 5) return `(function(){function add(a,b){return a+b}const g=add.bind(null,${a});return g(${b})})()`;              // partial: 1 bound
    if (k === 6) return `(function(){function add(a,b,c){return a+b+c}const g=add.bind(null,${a},${b});return g(${t})})()`;    // partial: 2 bound
    if (k === 7) return `(function(){const o={n:${t}};function f(p,q){return this.n+p+q};const g=f.bind(o,${a});return g(${b})})()`; // partial + this
    if (k === 8) return `(function(){function m(a,b){return a*b}const g=m.bind(null,${a});return g(${b})+","+g(${t})})()`;     // reuse across calls
    if (k === 9) return `(function(){function add(a,b){return a+b}return add(${a},${b})})()`;   // regression: plain
    return `(function(){function f(){return this.v};return f.call({v:${t}})})()`;               // regression: call
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-bindfn: ${checked} bind programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-bindfn: " + f); process.exit(1); }
