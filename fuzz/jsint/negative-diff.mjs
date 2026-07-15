// fuzz/jsint/negative-diff — the P7 JS engine's NEGATIVE NUMBERS, differential-
// fuzzed vs Node eval. Unary minus on literals + parenthesized values, negatives
// stored in variables / arrays, negatives through arithmetic / comparisons /
// ternaries / function args + returns. jsEval routes a SPACED leading `- ` (a
// source literal `-5` normalizes to `- 5`) through `0 - …`, while a glued `-5`
// (toText of a computed negative) is already a valid parseInt operand and flows
// the normal path. NOT fuzzed here: string coercion of a negative (`"x"+-1`) — a
// separate string-concat detail.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 700), rnd = mul(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const neg = () => -(1 + Math.floor(rnd() * 20));
  const any = () => Math.floor(rnd() * 21) - 10;      // -10..10
  const program = () => {
    const k = rnd();
    if (k < 0.15) return `${neg()}`;                                                   // bare negative literal
    if (k < 0.3) { const a = any(), b = any(), op = pick(["+", "-", "*"]); return `(${a})${op}(${b})`; } // (a) op (b), either may be negative
    if (k < 0.45) return `let n=${neg()};n`;                                            // stored negative
    if (k < 0.6) { const a = neg(), b = 1 + Math.floor(rnd() * 9), op = pick(["+", "-", "*"]); return `let n=${a};n${op}${b}`; } // arithmetic on a stored negative
    if (k < 0.72) { const a = any(), b = any(); return `[${a},${b}][${Math.floor(rnd() * 2)}]`; } // negative in an array + index
    if (k < 0.84) { const a = any(), b = any(); return `${a}<${b}?${a}:${b}`; }         // min via ternary, negatives
    if (k < 0.94) { const a = neg(); return `let f=function(x){return x*x};f(${a})`; }  // negative function arg
    const a = any(), b = any(); return `(${a})+(${b})`;                                 // parenthesized negatives summed
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
  if (!fails.length) console.log(`PASS jsint-negative: ${checked} negative-number programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL jsint-negative: " + f); process.exit(1); }
