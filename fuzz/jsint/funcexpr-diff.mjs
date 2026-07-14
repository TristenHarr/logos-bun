// fuzz/jsint/funcexpr-diff — the P7 JS engine's FUNCTION EXPRESSIONS (first-class
// function VALUES): `let f = function(params){body}` assigns an anonymous function
// to a variable, then `f(args)` calls it. Reuses the same call machinery as named
// `function f(){}` declarations (a chr(1)-tagged value in the env, params bound in
// the caller scope, body run to `return`). Covers multi-param, bodies with locals
// + control flow, string args/returns, and self-recursion (the name is in scope at
// call time). Differential-fuzzed vs Node eval. NOT yet: passing/returning
// functions (higher-order) or lexical capture — those are the next increments.
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
// Brace/paren-aware top-level `;` split: function bodies contain `;`, so a naive
// split miscounts. Everything but the last top-level part is a statement; the last
// is the final expression.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 700), rnd = mul(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const words = ["hi", "yo", "bun", "logos"];
  const program = () => {
    const k = rnd();
    if (k < 0.2) { const a = 1 + Math.floor(rnd() * 12); const c = 1 + Math.floor(rnd() * 9), op = pick(["+", "-", "*"]); return `let f=function(x){return x${op}${c}};f(${a})`; }
    if (k < 0.38) { const a = Math.floor(rnd() * 12), b = Math.floor(rnd() * 12); return `let g=function(a,b){return a*b};g(${a},${b})`; }
    if (k < 0.52) { const a = 1 + Math.floor(rnd() * 10); return `let f=function(x){let y=x*2;return y+1};f(${a})`; }              // body with a local
    if (k < 0.66) { const a = Math.floor(rnd() * 12), t = 3 + Math.floor(rnd() * 5); return `let f=function(n){if(n>${t}){return 100};return 0};f(${a})`; } // control flow (;-separated stmts, the interp convention)
    if (k < 0.78) { const w = pick(words); return `let id=function(s){return s};id(${JSON.stringify(w)})`; }                        // string arg/return
    if (k < 0.9) { const a = Math.floor(rnd() * 12), b = Math.floor(rnd() * 12); return `let mx=function(a,b){if(a>b){return a};return b};mx(${a},${b})`; }
    const nfac = 1 + Math.floor(rnd() * 6); return `let f=function(n){if(n<=1){return 1};return n*f(n-1)};f(${nfac})`;               // self-recursion
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
  if (!fails.length) console.log(`PASS jsint-funcexpr: ${checked} function-expression programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL jsint-funcexpr: " + f); process.exit(1); }
