// fuzz/jsint/hof-diff — the P7 JS engine's HIGHER-ORDER FUNCTIONS + LEXICAL
// CLOSURES, differential-fuzzed vs Node eval — the crown of the engine. Function
// values are now a fully OPAQUE spaceless token (encFn maps space/braces/parens/
// brackets/comma/semicolon to control chars 16-23,2; decFn inverts in callFn), so
// a function survives substitution and can be assigned to another variable, passed
// as an argument, and returned from a function; an inline function value is called
// directly (resolveCalls dispatches a chr(1) lastTok), and `mk()()` chains. LEXICAL
// CAPTURE: when a function expression is created (bindAssign or `return`), the
// defining env is substituted into its body, so `adder(x)` returns a closure over
// x (makeAdder → adder(5)(3)=8). No-arg functions work (bindParams skips the empty
// param). Value-capture at creation (not live-mutable capture — counters are a
// separate item).
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
const nodeRun = (p) => {
  let depth = 0, parts = [], cur = "";
  for (const c of p) {
    if (c === "{" || c === "(") depth++;
    else if (c === "}" || c === ")") depth--;
    if (c === ";" && depth === 0) { parts.push(cur); cur = ""; } else cur += c;
  }
  parts.push(cur);
  const body = parts.slice(0, -1).map((s) => s + ";").join("") + " return (" + parts[parts.length - 1] + ");";
  return eval("(()=>{" + body + "})()");
};
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 600), rnd = mul(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const sm = () => 1 + Math.floor(rnd() * 8);
  const program = () => {
    const k = rnd();
    if (k < 0.16) { const a = sm(), c = sm(), op = pick(["+", "-", "*"]); return `let f=function(x){return x${op}${c}};let g=f;g(${a})`; }              // assign a function to another var
    if (k < 0.34) { const a = sm(), b = sm(); return `let add=function(a,b){return a+b};let ap=function(fn,x,y){return fn(x,y)};ap(add,${a},${b})`; }  // pass a function
    if (k < 0.5) { const a = sm(), b = sm(); return `let adder=function(x){return function(y){return x+y}};adder(${a})(${b})`; }                        // closure, chained call
    if (k < 0.66) { const a = sm(), b = sm(); return `let mul=function(a){return function(b){return a*b}};let t=mul(${a});t(${b})`; }                   // closure, stored then called
    if (k < 0.8) { const a = sm(), c = sm(), op = pick(["+", "*"]); return `let mk=function(n){return function(){return n${op}${c}}};mk(${a})()`; }     // closure over n, no-arg inner
    if (k < 0.9) { const a = sm(), c = sm(); return `let make=function(){return function(x){return x+${c}}};make()(${a})`; }                            // returned fn, no capture
    const a = sm(), b = sm(), c = sm(); return `let f3=function(a){return function(b){return function(c){return a+b+c}}};f3(${a})(${b})(${c})`;         // triple-nested closure
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = nodeRun(p); } catch { continue; }
    if (typeof ref === "number" && (!Number.isInteger(ref) || Math.abs(ref) > 1e15)) continue;
    ref = String(ref);
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-hof: ${checked} higher-order/closure programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL jsint-hof: " + f); process.exit(1); }
