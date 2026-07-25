// fuzz/jsint/relchain — relational operators are LEFT-associative: 3>2>1 is (3>2)>1 = true>1 = false.
// jsEvalCmp split the whole chain and compared only the first two operands, dropping the rest (so it
// answered 3>2 and ignored >1). It now folds the running boolean leftward through the operands (relFold),
// matching JS. Exercises same-operator chains of </>/<=/>= of length 2-4 plus single comparisons and
// NaN operands as regressions. (Mixed-operator chains like 1<2>0 remain a separate pre-existing gap —
// evalValue can't compare the right sub-expression — and are not exercised.) Diffed vs Node.
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
  const ops = ["<", ">", "<=", ">="];
  const program = () => {
    const k = ri(6);
    const op = ops[ri(ops.length)];
    if (k === 0) { const c = 2 + ri(3); return Array.from({ length: c }, () => ri(6)).join(op); }         // same-op chain
    if (k === 1) return `${ri(9)}${op}${ri(9)}`;                                                            // single
    if (k === 2) return `${ri(9)}${op}${ri(9)}${op}${ri(9)}`;                                               // 3-operand
    if (k === 3) return `NaN${op}${ri(5)}`;                                                                 // NaN regression
    if (k === 4) return `let a=${ri(9)};a>${ri(9)}&&a<${ri(9)}`;                                            // && of two comparisons
    return `${ri(9)}${op}${ri(9)}${op}${ri(9)}?"t":"f"`;                                                    // chain as ternary cond
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String((0, eval)(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-relchain: ${checked} relational-chain programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-relchain: " + f); process.exit(1); }
