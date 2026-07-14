// fuzz/jsint/program-diff — the P7 JS engine as a PROGRAM INTERPRETER (jsRun):
// let-bindings + variable references + sequential statements, differential-fuzzed
// against Node's own eval(). Each program is a sequence of `let v = EXPR ;` lines
// (EXPR over integer literals + already-bound variables, using the full operator
// ladder) followed by a final expression; jsRun threads an environment and both
// engines must agree on the final value. Integer-exact (no % 0 / NaN).
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const run = (p) => { const r = spawnSync(OURS, ["__js-run", p], { encoding: "utf8" }); return r.status !== 0 ? `ERR:${r.status}` : (r.stdout || "").replace(/\n$/, ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 1500), rnd = mul(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  // An operand is a small literal or an already-bound variable.
  const operand = (vars) => (vars.length && rnd() < 0.5 ? pick(vars) : String(Math.floor(rnd() * 20)));
  const arith = (vars) => {
    const terms = 1 + Math.floor(rnd() * 3);
    let parts = [operand(vars)];
    for (let i = 1; i < terms; i++) {
      const o = pick(["+", "-", "*", "%"]);
      const rhs = o === "%" ? String(1 + Math.floor(rnd() * 19)) : operand(vars); // % nonzero literal
      parts.push(o, rhs);
    }
    return parts.join(" ");
  };
  const finalExpr = (vars) => (rnd() < 0.5 ? `${arith(vars)} ${pick(["<", ">", "<=", ">=", "==", "!="])} ${arith(vars)}` : arith(vars));
  const program = () => {
    const nBind = Math.floor(rnd() * 5), vars = [], lines = [];
    const names = "abcdefgh".split("");
    for (let i = 0; i < nBind; i++) { const v = names[i]; lines.push(`let ${v} = ${arith(vars)}`); vars.push(v); }
    lines.push(finalExpr(vars));
    return lines.join(" ; ");
  };
  let checked = 0;
  for (let i = 0; i < n; i++) {
    const p = program();
    // Reference: run the same program as an IIFE, returning the final expression.
    const parts = p.split(" ; ");
    const body = parts.slice(0, -1).map((s) => s + ";").join(" ") + " return (" + parts[parts.length - 1] + ");";
    let ref; try { ref = eval(`(()=>{ ${body} })()`); } catch { continue; }
    if (typeof ref === "number" && !Number.isInteger(ref)) continue;
    ref = String(ref);
    const got = run(p);
    if (got !== ref) fails.push(`jsRun(${JSON.stringify(p)}): ours=${got} node=${ref}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-program: ${checked} programs (let + vars + stmts) agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-program: " + f); process.exit(1); }
