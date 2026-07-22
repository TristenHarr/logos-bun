// fuzz/jsint/mathfloat-diff — float follow-ups on top of the f64 model: parseFloat (leading decimal,
// trailing junk ignored), Number.toFixed(n), and Math.floor/ceil/round/trunc/abs/sqrt over floats
// (correct for negatives, half-up round). All computed natively in f64 and formatted like V8.
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
const dir = mkdtempSync(join(tmpdir(), "mf-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const fv = () => `${ri(40) - 20}.${ri(100)}`;
  const program = () => {
    const k = ri(6);
    if (k === 0) return `console.log(parseFloat(${JSON.stringify(fv() + "abc")}));`;
    if (k === 1) return `console.log((${fv()}).toFixed(${ri(5)}));`;
    if (k === 2) { const op = ["floor", "ceil", "round", "trunc"][ri(4)]; return `console.log(Math.${op}(${fv()}));`; }
    if (k === 3) return `console.log(Math.abs(${fv()}));`;
    if (k === 4) return `console.log(Math.sqrt(${ri(200)}));`;
    return `console.log(parseFloat(${JSON.stringify("  " + fv() + " ")}));`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src);
    const got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-mathfloat: ${checked} parseFloat/toFixed/Math programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-mathfloat: " + f); process.exit(1); }
