// fuzz/jsint/asyncthrow — an async function that THROWS (or awaits a rejected promise) rejects its
// returned promise, so `.catch` / `.then(,onRej)` / `await`+try-catch see it, instead of the throw
// propagating uncaught. desugarAsync wraps each async function body in try/catch -> Promise.reject. Normal
// returns, awaited resolutions, explicit Promise.reject, chains, and async arrows are regression controls.
// Diffed vs Node (`bun run`).
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dir = OURS ? mkdtempSync(join(tmpdir(), "at-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const msgs = ["boom", "bad", "nope", "fail"];
  const m = () => JSON.stringify(msgs[ri(msgs.length)]);
  const program = () => {
    const a = ri(20), k = ri(14);
    if (k === 0) return `async function f(){throw new Error(${m()})}f().catch(e=>console.log("c:"+e.message))`;
    if (k === 1) return `async function f(){throw ${m()}}f().catch(e=>console.log("c:"+e))`;
    if (k === 2) return `async function f(){throw new Error(${m()})}f().then(x=>console.log("t")).catch(e=>console.log("c:"+e.message))`;
    if (k === 3) return `async function f(){await Promise.reject(${m()});return 1}f().catch(e=>console.log("c:"+e))`;
    if (k === 4) return `async function f(x){if(x<0)throw new Error("neg");return x*2}f(${a - 10}).then(v=>console.log("v:"+v),e=>console.log("c:"+e.message))`;
    // async ARROWS
    if (k === 5) return `const f=async()=>{throw new Error(${m()})};f().catch(e=>console.log("c:"+e.message))`;
    if (k === 6) return `const f=async(n)=>{if(n<0)throw new Error("neg");return n*2};f(${a - 10}).then(v=>console.log("v:"+v),e=>console.log("c:"+e.message))`;
    if (k === 7) return `Promise.resolve(${a}).then(async v=>{throw new Error("t"+v)}).catch(e=>console.log("c:"+e.message))`;
    if (k === 8) return `const f=async x=>{const y=await Promise.resolve(x);return y+1};f(${a}).then(v=>console.log("v:"+v))`;
    // regression controls
    if (k === 9) return `async function f(){return ${a}}f().then(x=>console.log("v:"+x))`;
    if (k === 10) return `async function f(){const y=await Promise.resolve(${a});return y+1}f().then(x=>console.log("v:"+x))`;
    if (k === 11) return `async function f(){return Promise.reject(${m()})}f().catch(v=>console.log("c:"+v))`;
    if (k === 12) return `const f=async()=>${a};f().then(v=>console.log("v:"+v))`;
    return `(async()=>{try{await Promise.reject(${m()})}catch(e){console.log("caught:"+e)}})()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    const ref = runFile("node", p);
    const got = runFile(OURS, p);
    if (got !== ref) fails.push(`run(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  rmSync(dir, { recursive: true, force: true });
  if (!fails.length) console.log(`PASS jsint-asyncthrow: ${checked} async-throw programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-asyncthrow: " + f); process.exit(1); }
