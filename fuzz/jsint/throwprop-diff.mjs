// fuzz/jsint/throwprop-diff — a `throw` that must cross one or more CALLED-function boundaries to reach
// an outer try/catch. Previously callFn/callMethod returned only the value, so `function f(){throw ...}
// try{f()}catch(e){}` never caught. A thread-local pending-throw channel now carries the thrown value up
// the native call chain: the callee stashes it (throwSet), runBlock drains it back into the caller's env
// as `__throw`, and the ordinary halt + try/catch take over. console.log skips its output when a throw is
// pending, so a throwing call nested in a side-effecting one doesn't print a spurious value first. Covers
// throw-in-called-fn, nested (g→f), throw guarded by a conditional, method throws, and the no-throw path
// (a returned value must still flow). Diffed vs Node.
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
const dir = mkdtempSync(join(tmpdir(), "tp-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 200), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const m = ["neg", "bad", "oops"][ri(3)], v = 1 + ri(50);
    const k = ri(7);
    if (k === 0) return `function f(){throw new Error(${JSON.stringify(m)});}try{f();}catch(e){console.log(e.message);}`;
    if (k === 1) return `function g(){throw new Error(${JSON.stringify(m)});}function f(){g();}try{f();}catch(e){console.log(e.message);}`;
    if (k === 2) return `function chk(x){if(x<0)throw new Error(${JSON.stringify(m)});return x*2;}try{console.log(chk(-${v}));}catch(e){console.log("c:"+e.message);}`;
    if (k === 3) return `function chk(x){if(x<0)throw new Error(${JSON.stringify(m)});return x*2;}try{console.log(chk(${v}));}catch(e){console.log("c");}`;  // no-throw path
    if (k === 4) return `let o={go(){throw new Error(${JSON.stringify(m)});}};try{o.go();}catch(e){console.log(e.message);}`;
    if (k === 5) return `function f(){throw ${v};}try{let y=f();console.log("no");}catch(e){console.log("caught "+e);}`;
    return `function f(){throw new Error(${JSON.stringify(m)});}try{f();}catch(e){console.log(e.message);}finally{console.log("fin");}`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src), got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-throwprop: ${checked} throw-propagation programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-throwprop: " + f); process.exit(1); }
