// fuzz/jsint/destructparam — a destructuring PARAMETER carrying an OUTER default: the ubiquitous options
// idiom `function f({a=1,b=2}={}){}` and `([a,b]=[1,2])=>`. bindParams handed the whole `{a=1,b=2}={}`
// text to destructureObj, which only strips the LAST char (assuming it is the closing brace), so the
// trailing `={}` leaked in and every field past the first was mis-parsed (b never bound → a + object).
// bindParams now peels the outer default at the depth-0 `=` (patDefEqIdx) and applies it via defaultOr
// (defExpr evaluated only when the argument is undefined) before destructuring the bare pattern. Exercises
// object/array patterns with inner + outer defaults, called with and without an argument; plain
// destructuring params (no outer default) are regressions. Diffed vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 260), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const da = 1 + ri(9), db = 1 + ri(9), va = 1 + ri(20), vb = 1 + ri(20), k = ri(7);
    if (k === 0) return `const g=({a=${da},b=${db}}={})=>a+b;g()`;
    if (k === 1) return `const g=({a=${da},b=${db}}={})=>a+b;g({a:${va}})`;
    if (k === 2) return `function g({a=${da},b=${db}}={}){return a*b}g({a:${va},b:${vb}})`;
    if (k === 3) return `const g=([a,b]=[${da},${db}])=>a+b;g()`;
    if (k === 4) return `const g=([a,b]=[${da},${db}])=>a-b;g([${va},${vb}])`;
    if (k === 5) return `const g=({a=${da},b=${db}})=>a+b;g({a:${va}})`;       // regression: no outer default
    return `const g=({a,b})=>a*b;g({a:${va},b:${vb}})`;                        // regression: no defaults at all
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String((0, eval)(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-destructparam: ${checked} destructuring-param-default programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-destructparam: " + f); process.exit(1); }
