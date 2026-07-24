// fuzz/jsint/bitcoerce — bitwise operators (| & ^ ~ << >> >>>) coercing NON-number operands via ToInt32.
// The operands were run through the native parseInt, which (a) can't take a tagStr STRING (`"123" | 0` →
// NaN), (b) PANICS on a non-integer (`3.7 | 0` crashed), and (c) is too lenient (`"12px" | 0` should be 0,
// not 12). Replaced with bitOperandInt = ToNumber (jsToNumberOf, now radix-aware so `"0xff" | 0` = 255)
// then safeInt truncation (NaN/Infinity → 0). This fuzzer stresses the coercion: number, float, decimal-
// string, hex-string, whitespace-padded, and junk-suffixed operands across all seven ops vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 400), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const ops = ["|", "&", "^", "<<", ">>", ">>>"];
  const operand = () => {
    const k = ri(6);
    if (k === 0) return String(ri(1000) - 500);
    if (k === 1) return String((ri(100000) / 100) * (ri(2) ? 1 : -1));
    if (k === 2) return JSON.stringify(String(ri(1000)));
    if (k === 3) return JSON.stringify("0x" + ri(65536).toString(16));
    if (k === 4) return JSON.stringify("  " + ri(100) + "  ");
    return JSON.stringify(ri(100) + "px");
  };
  const program = () => {
    if (ri(7) === 0) return `(function(){ return ~(${operand()}) })()`;
    return `(function(){ return (${operand()}) ${ops[ri(ops.length)]} (${operand()}) })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    if (ref.includes("e") || ref.includes("E")) continue;
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-bitcoerce: ${checked} bitwise-coercion programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-bitcoerce: " + f); process.exit(1); }
