// fuzz/jsint/undefinedreturn — a function that never executes a value-bearing return yields `undefined`,
// not the bare-empty __ret that coerced to NaN. callFn/callFn2/callFn3/callMethod now route their result
// through retVal (empty __ret → "undefined"), and a bare `return;` sets __ret to "undefined". This fuzzer
// builds functions that fall off the end, `return;` early, or conditionally return, and checks the observed
// value (via String(), typeof, and string concatenation) vs Node. A value-returning control is included.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const wrap = ["String", "typeof", "concat"];
  const program = () => {
    const k = ri(6);
    let body;
    if (k === 0) body = `function(){ let a=${ri(9)}; }`;
    else if (k === 1) body = `function(){ return; }`;
    else if (k === 2) body = `function(){ if(${ri(2)}===2) return ${ri(9)}; }`;
    else if (k === 3) body = `function(){ for(let i=0;i<${ri(3)};i++){} }`;
    else if (k === 4) body = `function(){ return ${ri(99)}; }`; // value-returning control
    else body = `function(x){ if(x>0) return x; return; }`;
    const call = k === 5 ? `(${body})(${ri(3) - 1})` : `(${body})()`;
    const w = wrap[ri(wrap.length)];
    if (w === "String") return `(function(){ return String(${call}) })()`;
    if (w === "typeof") return `(function(){ return typeof (${call}) })()`;
    return `(function(){ return "v=" + (${call}) })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-undefinedreturn: ${checked} no-return programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-undefinedreturn: " + f); process.exit(1); }
