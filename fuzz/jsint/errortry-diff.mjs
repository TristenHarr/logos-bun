// fuzz/jsint/errortry-diff — the Error constructors + try/catch/finally. `new Error(msg)` (and Type/
// Range/Syntax/ReferenceError) build a heap object with `message` + `name` — previously an unknown
// constructor recursed forever and stack-overflowed. `finally` now runs after try/catch whether or not
// an exception was thrown (and after a `return` in the try), with the original control-flow signal
// resuming. Covered: direct `throw new Error()` caught + message/name read, thrown primitives/objects,
// finally ordering, try-return-finally. (A throw that must cross a called-function boundary to reach an
// outer try is a separate open item — not exercised here.) Diffed vs Node.
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
const dir = mkdtempSync(join(tmpdir(), "err-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 200), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const msg = () => ["boom", "bad input", "oops42", "x"][ri(4)];
  const ekind = () => ["Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError"][ri(5)];
  const program = () => {
    const m = msg(), e = ekind(), v = 1 + ri(99);
    const k = ri(7);
    if (k === 0) return `try{throw new ${e}(${JSON.stringify(m)});}catch(err){console.log(err.name+": "+err.message);}`;
    if (k === 1) return `let e=new ${e}(${JSON.stringify(m)});console.log(e.message);`;
    if (k === 2) return `try{throw ${v};}catch(err){console.log("caught "+err);}`;
    if (k === 3) return `try{console.log("t");}catch(err){console.log("c");}finally{console.log("f");}`;
    if (k === 4) return `try{throw new Error(${JSON.stringify(m)});}catch(err){console.log(err.message);}finally{console.log("cleanup");}`;
    if (k === 5) return `function g(){try{return ${v};}finally{console.log("fin");}}console.log(g());`;
    return `try{throw {code:${v}};}catch(err){console.log(err.code);}`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src), got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-errortry: ${checked} error/try programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-errortry: " + f); process.exit(1); }
