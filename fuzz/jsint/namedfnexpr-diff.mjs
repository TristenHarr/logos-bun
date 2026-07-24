// fuzz/jsint/namedfnexpr-diff — NAMED function EXPRESSIONS in value position: `const f = function g(x)
// {…}`, a named callback `arr.map(function sq(x){…})`, a returned named fn `return function inner(x)
// {…}`. funcValueOf always keyed off the first `(`, so the name was always transparent to it — the bug
// was purely the guards recognizing only anonymous `function (`; isFnLiteral now lets the name past.
// Anonymous exprs, arrows, and plain declarations are re-checked as regressions. The last two shapes
// exercise SELF-RECURSION through the expression's own name (`let f = function g(n){ … g(n-1) … }`) —
// bindOne now binds the self-name so the body can call itself. Diffed vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const NODE = process.execPath;
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dir = mkdtempSync(join(tmpdir(), "nfe-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 200), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const nm = () => "gh" + ri(999);
  const program = () => {
    const a = 1 + ri(20), b = 1 + ri(20);
    const k = ri(8);
    if (k === 0) return `const f=function ${nm()}(x){return x*${a};};console.log(f(${b}));`;
    if (k === 1) return `let h=function ${nm()}(p,q){return p+q+${a};};console.log(h(${a},${b}));`;
    if (k === 2) return `console.log([${a},${b},${a + b}].map(function ${nm()}(x){return x*x;}).join(","));`;
    if (k === 3) return `function outer(){return function ${nm()}(x){return x+${a};};}console.log(outer()(${b}));`;
    if (k === 4) return `const f=function(x){return x-${a};};console.log(f(${b}));`;    // anon regression
    if (k === 5) { const g = nm(); return `let f=function ${g}(n){return n<=1?1:n*${g}(n-1);};console.log(f(${1 + ri(7)}));`; } // self-recursion: factorial
    if (k === 6) { const g = nm(); return `const f=function ${g}(n){return n<2?n:${g}(n-1)+${g}(n-2);};console.log(f(${1 + ri(9)}));`; } // self-recursion: fib
    return `function foo(x){return x+${a};}console.log(foo(${b}));`;                    // decl regression
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src), got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-namedfnexpr: ${checked} named-fn-expr programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-namedfnexpr: " + f); process.exit(1); }
