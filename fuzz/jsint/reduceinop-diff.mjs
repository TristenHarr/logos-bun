// fuzz/jsint/reduceinop-diff — four bounded gaps: Array.reduce with NO initial value (seed = element
// 0, start at 1), the `in` operator (key in object / index in array), String.split("") (→ chars), and
// parseFloat not crashing (integer inputs only; the fractional part needs floats, a separate gap).
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
const dir = mkdtempSync(join(tmpdir(), "rin-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const sn = () => 1 + ri(9);
  const words = ["hello", "abc", "world", "xy"];
  const w = () => words[ri(words.length)];
  const program = () => {
    const k = ri(6);
    if (k === 0) return `console.log([${sn()},${sn()},${sn()}].reduce((a,b)=>a+b));`;
    if (k === 1) return `console.log([${sn()},${sn()},${sn()},${sn()}].reduce((a,b)=>a>b?a:b));`;
    if (k === 2) return `console.log(${JSON.stringify(w())}.split("").reverse().join(""));`;
    if (k === 3) { const key = ["a", "b", "c"][ri(3)]; return `let o={a:1,b:2};console.log(${JSON.stringify(key)} in o);`; }
    if (k === 4) return `let arr=[${sn()},${sn()},${sn()}];console.log(${ri(5)} in arr);`;
    return `console.log(parseFloat(${JSON.stringify(String(sn()))}));`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src);
    const got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-reduceinop: ${checked} reduce/in/split/parseFloat programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-reduceinop: " + f); process.exit(1); }
