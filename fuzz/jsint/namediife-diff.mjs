// fuzz/jsint/namediife — an immediately-invoked NAMED function expression `(function f(n){…})(x)`. This
// was entirely mis-parsed (returned NaN even with no self-reference) because the callee dispatch keyed the
// anonymous-IIFE branch on the last token being literally `function`, but a NAMED expression makes the last
// token the function's own name — so it fell through and built nothing. Now, when the token before the
// callee name is `function`, it builds the function value with the correct params AND binds the self-name so
// the body can recurse: `(function fact(n){return n<=1?1:n*fact(n-1)})(5)` === 120. Exercises recursion
// (factorial/fibonacci/string-accumulate), non-recursive named IIFEs, multi-arg, and nested named IIFEs;
// anonymous IIFEs, named-fn declarations, and named-fn-expr-assigned-to-a-var are re-checked as regressions.
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
    const a = ri(8) + 1, b = ri(40), k = ri(9);
    if (k === 0) return `(function fact(n){return n<=1?1:n*fact(n-1)})(${a})`;                       // factorial recursion
    if (k === 1) return `(function fib(n){return n<2?n:fib(n-1)+fib(n-2)})(${ri(12)})`;              // fibonacci recursion
    if (k === 2) return `(function count(n){return n<=0?"":"x"+count(n-1)})(${a})`;                  // string-accumulate recursion
    if (k === 3) return `(function add(x,y){return x+y})(${b},${a})`;                                // named IIFE, multi-arg, no self-ref
    if (k === 4) return `(function id(x){return x*2})(${b})`;                                        // named IIFE, one arg
    if (k === 5) return `(function outer(n){return (function inner(m){return m*2})(n)+1})(${b})`;    // nested named IIFEs
    if (k === 6) return `(function(n){return n+${b}})(${a})`;                                        // regression: anonymous IIFE
    if (k === 7) return `(function(){let f=function g(n){return n<=1?1:n*g(n-1)};return f(${a})})()`; // regression: named-fn-expr assigned
    return `(function(){function h(n){return n<=1?1:n*h(n-1)}return h(${a})})()`;                    // regression: named-fn declaration
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-namediife: ${checked} named-IIFE programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-namediife: " + f); process.exit(1); }
