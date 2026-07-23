// fuzz/jsint/hoisting — function DECLARATION hoisting: a `function NAME(…){…}` is usable before its
// textual position in the block, and mutually-recursive declarations see each other. Was entirely
// unimplemented (used-before-declared → NaN). Fixed by hoistFns, a pre-pass in runBlockStr (function
// bodies) and runModuleBody (file top level) that binds every top-level function declaration before
// the statements run. Exercised inside an IIFE so a value is returned (the __js REPL path evaluates a
// trailing bare-call statement as an expression, a separate pre-existing gap, so we always `return`).
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const op = () => ["+", "-", "*"][ri(3)];
  const program = () => {
    const k = ri(6);
    if (k === 0) { // forward reference: call a helper declared after use
      const a = ri(20), o = op(), c = 1 + ri(9);
      return `(function(){return f(${a}); function f(n){return n${o}${c}}})()`;
    }
    if (k === 1) { // used in a let-init before its declaration
      const a = ri(20), c = 1 + ri(9);
      return `(function(){let x=g(${a}); function g(n){return n*${c}} return x})()`;
    }
    if (k === 2) { // mutual recursion, entry called before either declaration
      const nn = ri(8);
      return `(function(){return isEven(${nn}); function isEven(n){return n==0?1:isOdd(n-1)} function isOdd(n){return n==0?0:isEven(n-1)}})()`;
    }
    if (k === 3) { // helper called inside a loop before its declaration
      const c = 1 + ri(5);
      return `(function(){let s=0; for(let i=1;i<=4;i++){s=s+sq(i)} function sq(n){return n*n*${c}} return s})()`;
    }
    if (k === 4) { // recursive declaration used before its own textual position
      const nn = 1 + ri(6);
      return `(function(){return fact(${nn}); function fact(n){return n<=1?1:n*fact(n-1)}})()`;
    }
    // k === 5: two helpers, second used by first, first called before both declared
    const a = ri(20), c = 1 + ri(9);
    return `(function(){return outer(${a}); function outer(n){return inner(n)+${c}} function inner(m){return m*2}})()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-hoisting: ${checked} hoisting programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-hoisting: " + f); process.exit(1); }
