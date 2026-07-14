// fuzz/jsint/arith-diff — the FIRST slice of the P7 JS engine: a definitional
// arithmetic-expression evaluator (jsEval + evalParens) in pure LOGOS,
// differential-fuzzed against Node's own eval(). Covers + - * % with correct
// precedence (* % bind tighter than + -), left-to-right associativity, AND
// parenthesized subexpressions (nested grouping), over space-separated integer
// tokens. Division (JS float) and a real tokenizer (drop the space requirement)
// are later increments; the generator stays integer-exact so a diff is a real bug.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ours = (e) => { const r = spawnSync(OURS, ["__js-eval", e], { encoding: "utf8" }); return r.status !== 0 ? `ERR:${r.status}` : (r.stdout || "").replace(/\n$/, ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 2000), rnd = mul(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const num = () => String(Math.floor(rnd() * 30));
  const op = () => pick(["+", "-", "*", "%"]);
  // A factor is a number or, with decreasing probability by depth, a
  // parenthesized subexpression — so nesting stays bounded.
  const factor = (depth) => (depth < 3 && rnd() < 0.35 ? `( ${expr(depth + 1)} )` : num());
  const expr = (depth) => {
    const terms = 1 + Math.floor(rnd() * (depth === 0 ? 6 : 3));
    let parts = [factor(depth)];
    for (let i = 1; i < terms; i++) {
      let o = op(), rhs = factor(depth);
      if (o === "%") rhs = num() === "0" ? "1" : rhs; // reduce chance of % 0
      parts.push(o, rhs);
    }
    return parts.join(" ");
  };
  let checked = 0;
  for (let i = 0; i < n; i++) {
    const e = expr(0);
    let ref;
    try { ref = eval(e); } catch { continue; }
    if (!Number.isInteger(ref)) continue;         // guard: % by a paren that reduced to 0 → NaN
    ref = String(ref);
    const got = ours(e);
    if (got !== ref) fails.push(`jsEval(${JSON.stringify(e)}): ours=${got} node=${ref}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-arith: ${checked} expressions (with parens) agree with Node eval (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-arith: " + f); process.exit(1); }
