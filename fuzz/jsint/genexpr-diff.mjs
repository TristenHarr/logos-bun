// fuzz/jsint/genexpr — generator FUNCTION EXPRESSIONS (const g = function*(){…}) must produce a
// working generator, like the declaration form (function* g(){…}). desugarGenerators read the name
// as the first token after "function * ", but an anonymous expression's first token is the "(" of the
// parameter list — so it built a bogus header and the generator never ran (g().next() was undefined).
// genExprName now returns "" for the anonymous case. Exercises both forms consumed via spread,
// Array.from, for-of and .next(), with and without params. Diffed vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 300), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const yields = () => { const m = 1 + ri(3), a = 1 + ri(9); return Array.from({ length: m }, (_, j) => `yield ${a + j}`).join(";"); };
  const gen = () => ri(2) === 0
    ? `function* g(){${yields()}}`                    // declaration
    : `const g=function*(){${yields()}}`;             // anonymous expression
  const genP = () => `const g=function*(x){yield x;yield x+1}`;
  const program = () => {
    const k = ri(6);
    if (k === 0) return `(()=>{${gen()};return [...g()].join(",")})()`;
    if (k === 1) return `(()=>{${gen()};return Array.from(g()).join("-")})()`;
    if (k === 2) return `(()=>{${gen()};let s=0;for(const v of g())s+=v;return s})()`;
    if (k === 3) return `(()=>{${gen()};return g().next().value})()`;
    if (k === 4) return `(()=>{${genP()};return [...g(${ri(20)})].join(",")})()`;
    return `(()=>{${gen()};return [...g()].length})()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-genexpr: ${checked} generator-expression programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-genexpr: " + f); process.exit(1); }
