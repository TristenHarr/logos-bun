// fuzz/jsint/objstringify — coercing an object to a string: `""+o`, `String(o)`, `o.toString()`,
// `` `${o}` ``. Plain objects → "[object Object]", Error instances → "Name: message". These PANICKED
// ("Cannot parse 'NaN' as Int"): materialize returned raw "[object Object]" whose `[` was mis-read by
// resolveArrays as a bracket-index and parseInt'd. Fixed by objectTagStr (encoded brackets, decodes at
// output) + an Error-aware materialize. Plain string/array/number concat are the regression guards.
// (Plain objects that happen to carry BOTH `name` and `message` are avoided — the engine's Error
// heuristic keys off those two fields, a pre-existing edge distinct from this crash fix.)
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
    const k = ri(8);
    if (k === 0) return `(function(){ let o={a:${ri(9)},b:${ri(9)}}; return ""+o })()`;
    if (k === 1) return `(function(){ let o={x:${ri(9)}}; return String(o) })()`;
    if (k === 2) return `(function(){ let o={p:${ri(9)},q:${ri(9)}}; return o.toString() })()`;
    if (k === 3) return `(function(){ let o={a:1}; return \`val=\${o}\` })()`;
    if (k === 4) { const kind = ["Error", "TypeError", "RangeError"][ri(3)]; return `(function(){ let e=new ${kind}(${JSON.stringify("m" + ri(99))}); return ""+e })()`; }
    if (k === 5) { const kind = ["Error", "TypeError"][ri(2)]; return `(function(){ let e=new ${kind}(${JSON.stringify("boom" + ri(9))}); return String(e) })()`; }
    if (k === 6) return `(function(){ let e=new Error(${JSON.stringify("err" + ri(9))}); return \`caught: \${e}\` })()`;
    return `(function(){ let o={a:${ri(9)}}; return "pre:"+o+":post" })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-objstringify: ${checked} object-stringify programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-objstringify: " + f); process.exit(1); }
