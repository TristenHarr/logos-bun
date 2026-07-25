// fuzz/jsint/sequenceop — the comma/sequence operator `(a, b, c)`: evaluate each left to right, return
// the last. It produced NaN, breaking the ubiquitous reduce-to-object idiom `(acc[k]=v, acc)`. jsEvalIn
// now, after stripping a wrapping paren, evaluates a TOP-LEVEL comma as a sequence (topBinIdx keeps
// call/array/object commas at brace-depth ≥1, so only a genuine sequence splits). Exercises value,
// side-effecting head, reduce-to-object, and short-circuit RHS sequences; calls/arrays/objects/
// destructuring with commas are regressions that must NOT be treated as a sequence. Diffed vs Node.
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
    const a = ri(9), b = ri(9), c = 1 + ri(9), k = ri(9);
    if (k === 0) return `(${a},${b},${c})`;
    if (k === 1) return `let x=(${a}+1,${b}+2,${c}+3);x`;
    if (k === 2) return `let o={};let r=(o.k=${c},o);r.k`;
    if (k === 3) return `let cnt=0;let x=(cnt++,cnt++,cnt);x`;
    if (k === 4) return `let kv=[["a",${a}],["b",${b}]];JSON.stringify(kv.reduce((o,[k,v])=>(o[k]=v,o),{}))`;
    if (k === 5) return `let f=()=>(${a},${b},${c});f()`;
    if (k === 6) return `Math.max(${a},${b},${c})`;                    // regression: call args
    if (k === 7) return `[${a},${b},${c}].join("-")`;                  // regression: array
    return `let o={a:${a},b:${b},c:${c}};o.a+o.b+o.c`;                 // regression: object literal
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String((0, eval)(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-sequenceop: ${checked} sequence-operator programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-sequenceop: " + f); process.exit(1); }
