// fuzz/jsint/foreach-diff — Array.prototype.forEach: runs the callback for side effects (element +
// index), returns undefined. The callback executes in the enclosing env (fnArgValRaw), so a
// statement body can mutate an outer heap ref (push to an outer array, set on an outer Map) and it
// persists through the handle. Covers element/index side effects and the undefined return; the
// output is materialised via an outer array's .join to diff deterministically vs Node. (Expression-
// body `x=>a.push(x)` and outer SCALAR reassignment are separate pre-existing engine gaps, excluded.)
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
const dir = mkdtempSync(join(tmpdir(), "foreach-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const arr = () => { const len = 1 + ri(4); const xs = []; for (let i = 0; i < len; i++) xs.push(1 + ri(9)); return "[" + xs.join(",") + "]"; };
  const program = () => {
    const k = ri(4), a = arr();
    if (k === 0) return `let o=[];${a}.forEach(x=>{o.push(x*2);});console.log(o.join(","));`;
    if (k === 1) return `let o=[];${a}.forEach((x,i)=>{o.push(i+":"+x);});console.log(o.join(","));`;
    if (k === 2) return `let m=new Map();${a}.forEach((x,i)=>{m.set(i,x);});console.log(${a}.map((_,i)=>m.get(i)).join(","));`;
    return `let r=${a}.forEach(x=>{});console.log(String(r));`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src);
    const got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-foreach: ${checked} forEach programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-foreach: " + f); process.exit(1); }
