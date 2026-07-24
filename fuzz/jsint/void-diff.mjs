// fuzz/jsint/void — the `void` operator evaluates its operand and yields undefined (void 0, void expr,
// typeof void x === "undefined"). Matched only as a space-delimited token so identifiers like `avoid`/
// `avoidance` are never corrupted; unary precedence via typeofOperandLen means `void 0 + 1` is
// `(void 0) + 1` (NaN). Operands here are side-effect-free (a variable-ASSIGNMENT operand, void(c=5),
// is a known limitation — the expression-level resolver has no env write-back). Diffed vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 300), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const operand = () => [`${ri(100)}`, `"${["x", "hi", ""][ri(3)]}"`, `[${ri(9)}]`, `(${ri(9)}+${ri(9)})`, `${ri(9)}*2`][ri(5)];
  const program = () => {
    const k = ri(7);
    if (k === 0) return `String(void ${operand()})`;
    if (k === 1) return `typeof void ${operand()}`;
    if (k === 2) return `void ${operand()}===undefined?"t":"f"`;
    if (k === 3) return `void ${ri(9)}+1`;                              // (void x)+1 = NaN
    if (k === 4) return `[void 0, ${ri(9)}].length`;
    if (k === 5) return `(()=>{const avoid=${ri(9)};return avoid})()`;  // regression: identifier
    return `(()=>{let avoidance=${ri(9)};return avoidance+1})()`;       // regression: identifier
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-void: ${checked} void-operator programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-void: " + f); process.exit(1); }
