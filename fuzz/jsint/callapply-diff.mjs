// fuzz/jsint/callapply — Function.prototype.call / .apply on a user function. Both were unimplemented
// (`f.call(obj,…)` produced garbage). Now they route to callMethod with `this` bound to the first argument:
// `.call(thisArg, a, b)` passes `a, b`; `.apply(thisArg, [a,b])` spreads the array's element VALUES the same
// way (jsEvalIn is idempotent on values, so no re-eval). callMethod also now binds `arguments`, so a
// call/apply'd function that uses `arguments` works too. Exercises `this` access, extra call args, apply
// with an array, and arguments inside a called function; string/array method receivers and plain calls are
// re-checked as regressions (the .call/.apply handlers only fire for a real function value). Diffed vs Node.
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
    const a = ri(50), b = ri(50), t = ri(50), k = ri(7);
    if (k === 0) return `(function(){function f(){return this.x}return f.call({x:${t}})})()`;
    if (k === 1) return `(function(){function f(p,q){return this.n+p+q}return f.call({n:${t}},${a},${b})})()`;
    if (k === 2) return `(function(){function f(p,q){return p*q}return f.apply(null,[${a},${b}])})()`;
    if (k === 3) return `(function(){function g(s){return s+":"+this.tag}return g.call({tag:"T${t}"},"v${a}")})()`;
    if (k === 4) return `(function(){function sum(){let s=0;for(let i=0;i<arguments.length;i++)s+=arguments[i];return s}return sum.apply(null,[${a},${b},${t}])})()`;
    if (k === 5) return `(function(){return "abc${a % 10}".toUpperCase()})()`;   // regression: string method
    return `(function(){function add(x,y){return x+y}return add(${a},${b})})()`;  // regression: plain call
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-callapply: ${checked} call/apply programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-callapply: " + f); process.exit(1); }
