// fuzz/jsint/unarysign — a unary sign on the operand of a binary arithmetic op (`3 * -1`, `5 + -3`,
// `2 * -3 * -4`, `100 + -d`) used to mis-tokenize into a standalone `-` and PANIC parseInt. foldSigns now
// folds each unary `-`/`+` (in operand position: at start or after an operator/`(`) into the following
// number by sign parity, so all of int/float/bigint evaluate it. Binary `-`/`+`, parens, powers, floats,
// and string-coercion arithmetic are regression controls. Diffed vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dir = OURS ? mkdtempSync(join(tmpdir(), "us-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const nz = () => 1 + ri(9);
  const op = () => ["+", "-", "*"][ri(3)];
  const program = () => {
    const a = nz(), b = nz(), c = nz(), k = ri(13);
    if (k === 0) return `console.log(${a} ${op()} -${b})`;               // op then negative literal
    if (k === 1) return `console.log(${a}${["+", "*"][ri(2)]}-${b})`;    // no spaces (not `-`, which reads as `--`)
    if (k === 2) return `console.log(${a} * -${b} * -${c})`;              // chained negatives
    if (k === 3) return `console.log(${a} - -${b})`;                      // minus minus
    if (k === 4) return `console.log(${a} + -${b} + ${c})`;              // mixed
    if (k === 5) return `function f(x){return x*-${b}} console.log(f(${a}))`;
    if (k === 6) return `console.log([${a},${b},${c}].map(x=>x*-1).join(","))`;
    if (k === 7) return `let d=${b}; console.log(${a} + -d)`;             // unary on a var
    if (k === 8) return `console.log(${a} * +${b})`;                      // unary plus
    // regression controls
    if (k === 9) return `console.log(${a} ${op()} ${b})`;                 // plain binary
    if (k === 10) return `console.log(${a} * (-${b}))`;                   // parenthesized
    if (k === 11) return `console.log(${a}.5 - ${b}.5)`;                  // floats
    return `console.log("${a}" * ${b} - ${c})`;                          // string-coercion
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    const ref = runFile("node", p);
    const got = runFile(OURS, p);
    if (got !== ref) fails.push(`run(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  rmSync(dir, { recursive: true, force: true });
  if (!fails.length) console.log(`PASS jsint-unarysign: ${checked} unary-sign programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-unarysign: " + f); process.exit(1); }
