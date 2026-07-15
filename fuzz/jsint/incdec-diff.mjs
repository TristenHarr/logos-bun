// fuzz/jsint/incdec-diff — the P7 JS engine's INCREMENT/DECREMENT `++`/`--`,
// differential-fuzzed vs Node eval. `++`/`--` are 2-char tokens (isOp2), desugared
// in execStmt to `x = x + 1` / `x = x - 1` (postfix AND prefix collapse to the
// same statement effect — concat of the text around `++` recovers the var name
// either way). The headline: `for(let i=0;i<n;i++)` and `for(let i=n;i>0;i--)` —
// the canonical JS loop forms. Used AS A STATEMENT, so postfix-vs-prefix value
// semantics don't apply (out of scope: `y = x++`).
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 600), rnd = mul(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const program = () => {
    const k = rnd();
    if (k < 0.2) { const a = 1 + Math.floor(rnd() * 20); return `let x=${a};x++;x`; }
    if (k < 0.35) { const a = 1 + Math.floor(rnd() * 20); return `let x=${a};x--;x`; }
    if (k < 0.5) { const a = 1 + Math.floor(rnd() * 20); return `let x=${a};++x;x`; }                 // prefix
    if (k < 0.72) { const N = 2 + Math.floor(rnd() * 7); return `let s=0;for(let i=0;i<${N};i++){s+=i};s`; } // up-loop with i++
    if (k < 0.9) { const N = 2 + Math.floor(rnd() * 7); return `let s=0;for(let i=${N};i>0;i--){s+=1};s`; }   // down-loop with i--
    const a = 3 + Math.floor(rnd() * 10); return `let n=${a};n--;n--;n++;n`;                           // sequence
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
  if (!fails.length) console.log(`PASS jsint-incdec: ${checked} increment/decrement programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL jsint-incdec: " + f); process.exit(1); }
