// fuzz/jsint/tonumber — ToNumber at the numeric-operator boundary. `-` `*` `/` `%` are ALWAYS
// numeric: a string operand is coerced via ToNumber (valid-numeric-string→number, else NaN), while
// `+` stays string-concatenation. Was broken: `"5"-2` returned the left operand and `10-"4"` stack-
// overflowed. The `+` concat cases are the regression guard (must NOT become arithmetic).
// Programs are BARE EXPRESSIONS evaluated by `__js` (prints the value), diffed vs Node's eval.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const num = () => String(1 + ri(20));
  const numStr = () => JSON.stringify(String(1 + ri(20)));
  const badStr = () => JSON.stringify(["a", "x9", "", " 3 "][ri(4)]);
  const operand = () => { const k = ri(4); return k === 0 ? num() : k === 1 ? numStr() : k === 2 ? numStr() : badStr(); };
  const arithOp = () => ["-", "*", "/", "%"][ri(4)];
  const program = () => {
    const k = ri(7);
    if (k === 0) return `${operand()} ${arithOp()} ${operand()}`;                     // binary numeric
    if (k === 1) return `${numStr()} + ${num()}`;                                     // concat guard
    if (k === 2) return `${num()} + ${numStr()}`;                                     // concat guard
    if (k === 3) return `${operand()} ${arithOp()} ${operand()} ${arithOp()} ${operand()}`; // chain
    if (k === 4) return `(${numStr()} ${arithOp()} ${num()}) + "!"`;                  // arith then concat
    if (k === 5) return `let a = ${operand()}; a ${arithOp()} ${operand()}`;          // string VAR in arith (substitution)
    return `let s = ${badStr()}; s + "!"`;                                            // string VAR concat guard
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-tonumber: ${checked} coercion programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-tonumber: " + f); process.exit(1); }
