// fuzz/jsint/negindex-diff — negative & out-of-bounds indexing must never panic. Bracket access
// a[i] with i<0 or i>=len is undefined (a negative index is a property miss, NOT from-end). slice
// clamps and reads negatives from the end (n+idx floored at 0). Before the fix, a[-1] / slice(-1)
// fed -1 to the 1-based `item` builtin, which wrapped to usize::MAX and aborted the process.
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
const dir = mkdtempSync(join(tmpdir(), "negidx-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const arr = () => { const len = 1 + ri(5); const xs = []; for (let i = 0; i < len; i++) xs.push(1 + ri(9)); return "[" + xs.join(",") + "]"; };
  const idx = () => ri(9) - 4;   // -4..4
  const program = () => {
    const k = ri(5), a = arr();
    if (k === 0) return `let a=${a};console.log(String(a[${idx()}]));`;
    if (k === 1) return `console.log(${a}.slice(${idx()}).join(","));`;
    if (k === 2) return `console.log(${a}.slice(${idx()},${idx()}).join(","));`;
    if (k === 3) return `console.log(String(${a}[${idx()}]===undefined));`;
    return `console.log(${JSON.stringify("abcdef".slice(0, 1 + ri(5)))}.slice(${idx()}));`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src);
    const got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-negindex: ${checked} neg-index/slice programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-negindex: " + f); process.exit(1); }
