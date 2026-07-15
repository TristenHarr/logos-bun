// fuzz/jsint/truthy-diff — the P7 JS engine's TRUTHINESS in if/while/ternary
// conditions, differential-fuzzed vs Node eval. boolOf previously called ONLY the
// literal "true" truthy, so `if(5)`, `while(x)`, `5?a:b` all mis-evaluated; boolOf
// now implements JS falsiness (false/0/""/null/undefined/empty-string → false,
// everything else → true). Covers a numeric condition in if / ternary, a numeric
// while-loop counter (`while(x){x--}`), and — regression — a comparison condition.
// NOT fuzzed: operand-returning `&&`/`||` (our && yields a boolean, a separate
// value-model item) or `if("")` (empty-string tagging edge).
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
  const program = () => {
    const k = rnd();
    if (k < 0.28) { const v = Math.floor(rnd() * 4); return `let n=${v};let r=0;if(n){r=1}else{r=2};r`; }      // if(numeric truthiness)
    if (k < 0.5) { const v = Math.floor(rnd() * 4); return `${v}?10:20`; }                                     // numeric ternary condition
    if (k < 0.72) { const v = 1 + Math.floor(rnd() * 6); return `let x=${v};let c=0;while(x){x=x-1;c=c+1};c`; } // while(x) countdown, c ends = x0
    if (k < 0.86) { const a = Math.floor(rnd() * 8), b = Math.floor(rnd() * 8); return `let r=0;if(${a}>${b}){r=1}else{r=2};r`; } // comparison condition (regression)
    const v = Math.floor(rnd() * 4); return `let r=9;if(${v}){r=${v}+1};r`;                                     // if with no else
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
  if (!fails.length) console.log(`PASS jsint-truthy: ${checked} truthiness programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL jsint-truthy: " + f); process.exit(1); }
