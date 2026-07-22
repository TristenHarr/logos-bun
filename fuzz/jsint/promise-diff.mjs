// fuzz/jsint/promise-diff — Promise.resolve + .then + chaining + microtask ordering (E2). The
// engine is synchronous, so `.then` callbacks are deferred onto a microtask queue drained after
// the main script — reproducing JS ordering (`Promise.resolve().then(f); g()` runs g before f)
// and chained-then resolution. Whole .js programs run through `bun run` and diffed (stdout) vs
// Node, so console.log ordering is the observable.
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
const dir = mkdtempSync(join(tmpdir(), "pdiff-"));
const runFile = (bin, src) => { const f = join(dir, "p.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 300), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const sn = () => 1 + ri(9);
  const program = () => {
    const k = ri(12), a = sn(), b = sn(), c = sn();
    if (k === 9) return `async function f(){let x=await Promise.resolve(${a});console.log(x+${b})};f();`;
    if (k === 10) return `async function m(){return ${a}};async function f(){let v=await m();console.log(v*${b})};f();`;
    if (k === 11) return `async function f(){let x=await Promise.resolve(${a}).then(v=>v+${b});console.log(x)};f();`;
    if (k === 0) return `Promise.resolve(${a}).then(x=>console.log(x));console.log(${b});`;
    if (k === 1) return `Promise.resolve(${a}).then(x=>x*${b}).then(y=>console.log(y));`;
    if (k === 2) return `console.log(${a});Promise.resolve().then(()=>console.log(${b}));console.log(${c});`;
    if (k === 3) return `Promise.resolve(${a}).then(x=>x+${b}).then(y=>y*${c}).then(z=>console.log(z));`;
    if (k === 4) return `Promise.resolve(${a}).then(x=>console.log(x));Promise.resolve(${b}).then(x=>console.log(x));`;
    if (k === 5) return `new Promise((res)=>{res(${a})}).then(x=>console.log(x));`;
    if (k === 6) return `new Promise((resolve,reject)=>{resolve(${a})}).then(v=>console.log(v*${b}));`;
    if (k === 7) return `new Promise((res)=>{res(${a})}).then(x=>x+${b}).then(y=>console.log(y));`;
    return `let p=Promise.resolve(${a});p.then(x=>console.log(x+${b}));console.log(${c});`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src);
    const got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-promise: ${checked} promise programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-promise: " + f); process.exit(1); }
