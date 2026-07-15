// fuzz/jsint/trycatch-diff — try/catch/throw (same-scope). A `throw expr` sets an
// env __throw flag; every loop/block halts on it (hasHalt = hasReturn OR hasThrow),
// mirroring return; execTry runs the try block, and if it threw, binds the catch
// param to the thrown value, clears the flag, and runs the catch block. Covers direct
// throw, throw-skips-rest, nested-if throw, throw inside a loop body caught per
// iteration, and the caught value's use. Cross-FUNCTION throw (a throw inside a
// called function reaching the caller's catch) is a documented limitation, excluded.
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
  const sn = () => 1 + ri(9);
  const program = () => {
    const k = ri(7);
    if (k === 0) return `let r="";try{throw "e${sn()}"}catch(e){r=e};r`;                                     // direct string throw
    if (k === 1) return `let r=${sn()};try{r=${sn()};throw "x";r=99}catch(e){r=r+${sn()}}; r`;               // throw skips rest of try
    if (k === 2) return `let r="";try{r="ok${sn()}"}catch(e){r="caught"};r`;                                  // no throw -> try value
    if (k === 3) return `let n=0;try{throw ${sn()}}catch(e){n=e+${sn()}};n`;                                  // numeric throw + use
    if (k === 4) { const t = ri(3); return `let r="";try{let x=${t};if(x>0){throw "pos"}else{r="zero"}}catch(e){r=e};r`; } // nested if throw or not
    if (k === 5) return `let s="";for(let i=0;i<${2 + ri(3)};i++){try{if(i===1){throw "H"};s=s+i}catch(e){s=s+"C"}};s`; // loop, caught per-iter
    return `let r="";try{throw "abc"}catch(err){r="len"+err.length};r`;                                        // caught value method
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
  if (!fails.length) console.log(`PASS jsint-trycatch: ${checked} try/catch programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-trycatch: " + f); process.exit(1); }
