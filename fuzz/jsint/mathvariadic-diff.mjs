// fuzz/jsint/mathvariadic-diff — Math.max / Math.min made VARIADIC + spread-aware:
// Math.max(a,b,c,...), Math.max(...arr) (the max-of-an-array idiom), and mixed
// Math.max(x, ...arr, y). methodArg -> expandSpreadArgs (reused from call spread) ->
// splitArgsN -> maxFold/minFold over all args. 2-arg and nested Math still work.
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
const nodeRun = (p) => {
  let depth = 0, parts = [], cur = "";
  for (const c of p) { if (c === "{" || c === "(" || c === "[") depth++; else if (c === "}" || c === ")" || c === "]") depth--; if (c === ";" && depth === 0) { parts.push(cur); cur = ""; } else cur += c; }
  parts.push(cur);
  const body = parts.slice(0, -1).map((s) => s + ";").join("") + " return (" + parts[parts.length - 1] + ");";
  return eval("(()=>{" + body + "})()");
};
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const sn = () => 1 + ri(20);
  const fn = () => (ri(2) ? "max" : "min");
  const nums = (len) => Array.from({ length: len }, () => sn());
  const program = () => {
    const k = ri(6);
    if (k === 0) { const a = nums(2 + ri(4)); return `Math.${fn()}(${a.join(",")})`; }                          // variadic literals
    if (k === 1) { const a = nums(2 + ri(5)); return `let a=[${a.join(",")}];Math.${fn()}(...a)`; }              // spread array
    if (k === 2) { const a = nums(2 + ri(3)); return `let a=[${a.join(",")}];Math.${fn()}(${sn()},...a,${sn()})`; } // mixed
    if (k === 3) return `Math.${fn()}(${sn()},${sn()})`;                                                          // 2-arg
    if (k === 4) { const a = nums(3 + ri(3)); return `let a=[${a.join(",")}].map(x=>x*2);Math.${fn()}(...a)`; }   // map then spread
    return `Math.max(Math.min(${sn()},${sn()}),${sn()})`;                                                        // nested Math
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = nodeRun(p); } catch { continue; }
    ref = String(ref);
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-mathvariadic: ${checked} variadic-Math programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-mathvariadic: " + f); process.exit(1); }
