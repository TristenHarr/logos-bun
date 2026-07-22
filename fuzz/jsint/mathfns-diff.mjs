// fuzz/jsint/mathfns-diff — the correctly-rounded Math surface over f64: constants (PI/E/SQRT2/LN2/…),
// Math.pow with integer results, variadic Math.max/min on floats, and Math.sqrt of perfect squares —
// all bit-exact with V8. (Transcendentals — sin/cos/tan/log/exp/atan/atan2/hypot/cbrt on arbitrary
// inputs — are computed in f64 and correct, but can differ from V8 by 1 ULP in the last bit because
// IEEE-754 does not mandate correctly-rounded transcendentals and Rust's libm ≠ V8's fdlibm; they are
// exercised manually, not asserted bit-for-bit here.)
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const NODE = process.execPath;
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dir = mkdtempSync(join(tmpdir(), "mfn-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const fv = () => `${1 + ri(20)}.${ri(100)}`;
  const program = () => {
    const k = ri(6);
    if (k === 0) return `console.log(Math.${["PI", "E", "SQRT2", "SQRT1_2", "LN2", "LN10", "LOG2E", "LOG10E"][ri(8)]});`;
    if (k === 1) return `console.log(Math.pow(${2 + ri(5)},${ri(6)}));`;                 // integer result
    if (k === 2) return `console.log(Math.max(${fv()},${fv()},${fv()}));`;
    if (k === 3) return `console.log(Math.min(${fv()},${fv()}));`;
    if (k === 4) { const n = 1 + ri(30); return `console.log(Math.sqrt(${n * n}));`; }    // perfect square
    return `console.log(2*Math.PI*${1 + ri(5)});`;                                        // exact * of the const
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src);
    const got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-mathfns: ${checked} Math fn/const programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-mathfns: " + f); process.exit(1); }
