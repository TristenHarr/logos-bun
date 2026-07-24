// fuzz/jsint/callnonfn — calling a non-function PRIMITIVE must throw a TypeError, not silently return
// undefined. `undefined()`, `null()`, `true()`, and `x()` where x holds a number/null now throw a TypeError
// (`<x> is not a function`), caught by the surrounding try/catch. The discriminator fires only when the
// callee token is genuinely in call position (an identifier or value literal directly before the `(`) AND
// resolves to a non-callable PRIMITIVE (undefined/null/boolean/number) — deliberately narrow so objects,
// strings, class constructors (incl. nested `new`), and generator functions are never mis-judged, and a
// grouping paren `(2+3)`, an operator before a group, a real function call, an arrow, a method, an IIFE, and
// a named-function-expression call are all left untouched. This fuzz pits the throw cases against a large
// set of valid-call / grouping regressions so a false-positive throw (breaking real code) is caught. (A
// missing METHOD `o.missing()` and a string-literal call `"s"()` are separate unhandled edges, not covered
// here.) Diffed vs Node.
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
    const a = ri(50), b = ri(50) + 1, k = ri(16);
    // throw cases (constructor.name === "TypeError")
    if (k === 0) return `(function(){try{undefined()}catch(e){return e.constructor.name}})()`;
    if (k === 1) return `(function(){try{null()}catch(e){return e.constructor.name}})()`;
    if (k === 2) return `(function(){try{let x=${a};x()}catch(e){return e.constructor.name}})()`;
    if (k === 3) return `(function(){try{let x=null;x()}catch(e){return e.constructor.name}})()`;
    if (k === 4) return `(function(){try{let f;f(${a})}catch(e){return e.constructor.name}})()`;
    if (k === 5) return `(function(){try{(${a})()}catch(e){return e.constructor.name}})()`;
    if (k === 6) return `(function(){try{undefined()}catch(e){return e instanceof TypeError}})()`;
    // grouping / valid-call regressions
    if (k === 7) return `(function(){return (${a}+${b})*2})()`;
    if (k === 8) return `(function(){const x=${a};return (x)*${b}})()`;
    if (k === 9) return `(function(){function f(y){return y+${a}}return f(${b})})()`;
    if (k === 10) return `(function(){const add=(p,q)=>p+q;return add(${a},${b})})()`;
    if (k === 11) return `(function(){const o={m(){return ${a}}};return o.m()})()`;
    if (k === 12) return `(function(){return [${a},${b}].map(x=>x*2).reduce((p,q)=>p+q,0)})()`;
    if (k === 13) return `(function(){return (function(z){return z+${a}})(${b})})()`;
    if (k === 14) return `(function(){const g=function fact(m){return m<=1?1:m*fact(m-1)};return g(${1 + (a % 6)})})()`;
    return `(function(){let s=0;[${a},${b}].forEach(v=>s+=v);return s})()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-callnonfn: ${checked} call/throw programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-callnonfn: " + f); process.exit(1); }
