// fuzz/jsint/assignexpr — assignment used as an EXPRESSION (its value is the assigned value): the
// keystone `return memo[n] = compute()` memoization idiom, `return m[k]=v`, chained `a[i]=b[j]=v`,
// scalar `return x=v`, a parenthesized `(m[k]=v)`, and an assignment whose RHS is a ternary
// (`x = c ? a : b`, since assignment binds looser than `?:`). The engine only handled assignment as a
// STATEMENT — in value position it fell through to plain eval and yielded NaN with no write. Fixed in
// jsEvalIn: a top-level bare `=` (before any top-level `?`/`=>`, so a ternary RHS and an arrow body are
// not mistaken for it) performs the write onto the heap container (globally visible) and returns the
// assigned value; parenthesized wrappers are stripped first. Reads of a mutated container are done in a
// SEPARATE statement (`let r = …; …`) to avoid the unrelated pre-existing inline-mutator-in-concat
// ordering gap. Node is the oracle.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 400), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const k = ri(7);
    if (k === 0) return `(function(){ let memo={}; function fib(n){ if(n<2) return n; if(memo[n]) return memo[n]; return memo[n]=fib(n-1)+fib(n-2) } return fib(${5 + ri(12)}) })()`;
    if (k === 1) return `(function(){ let m={}; function f(n){ return m[n]=n*${1 + ri(9)} } let r=f(${ri(9)}); return r+"|"+JSON.stringify(m) })()`;
    if (k === 2) return `(function(){ let a=[0],b=[0]; a[0]=b[0]=${ri(99)}; return a[0]+","+b[0] })()`;
    if (k === 3) return `(function(){ let x; return x=${ri(99)} })()`;
    if (k === 4) return `(function(){ let m={},n=${ri(9)}; let r=(m[n]=n+n); return r+"|"+JSON.stringify(m) })()`;
    if (k === 5) return `(function(){ let x; return x = ${ri(2)} ? ${ri(9)} : ${ri(9)} })()`;
    return `(function(){ let o={}; function set(k,v){ return o[k]=v } let a=set("p",${ri(9)}); let b=set("q",${ri(9)}); return a+"/"+b+"/"+JSON.stringify(o) })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-assignexpr: ${checked} assignment-expression programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-assignexpr: " + f); process.exit(1); }
