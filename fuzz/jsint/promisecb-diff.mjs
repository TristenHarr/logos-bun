// fuzz/jsint/promisecb — promise callbacks with DESTRUCTURING parameters (.then(([a,b])=>…),
// .then(({x,y})=>…)) which previously bound the whole pattern text as one name (→ NaN), plus the
// Promise.race / Promise.allSettled statics that were missing. The callback value is already resolved,
// so it is destructured through the same array/object pattern binder as any other call. Diffed vs Node
// by writing a module file and running both `bun run` and `node` on it (console.log output compared).
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "pcb-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8" }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 120), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = ri(20), b = ri(20), c = ri(20), k = ri(16);
    if (k === 0) return `Promise.all([Promise.resolve(${a}),Promise.resolve(${b})]).then(([x,y])=>console.log(x+y))`;
    if (k === 1) return `Promise.resolve([${a},${b},${c}]).then(([p,q,r])=>console.log(p*100+q*10+r))`;
    if (k === 2) return `Promise.resolve({m:${a},n:${b}}).then(({m,n})=>console.log(m-n))`;
    if (k === 3) return `Promise.race([Promise.resolve(${a}),Promise.resolve(${b})]).then(v=>console.log(v))`;
    if (k === 4) return `Promise.allSettled([Promise.resolve(${a}),Promise.reject(${b})]).then(r=>console.log(JSON.stringify(r)))`;
    if (k === 5) return `Promise.all([${a},${b}].map(x=>Promise.resolve(x*2))).then(([x,y])=>console.log(x,y))`;
    if (k === 6) return `async function m(){const[x,y]=await Promise.all([Promise.resolve(${a}),Promise.resolve(${b})]);console.log(x+y)}m()`;
    if (k === 7) return `Promise.resolve(${a}).then(x=>console.log(x*2))`;                 // regression: plain param
    if (k === 8) return `async function f(){return ${a}}f().then(v=>console.log(v*2))`;    // async-return chaining
    if (k === 9) return `Promise.reject(${a}).then(()=>{},e=>console.log("r:"+e))`;         // two-arg then onRejected
    if (k === 10) return `Promise.resolve(${a}).then(x=>{throw x+${b}}).catch(e=>console.log("c:"+e))`; // throw in then
    if (k === 11) return `async function f(){try{await Promise.reject(${a})}catch(e){console.log("await-c:"+e)}}f()`; // await reject
    if (k === 12) return `Promise.resolve(${a}).then(x=>Promise.resolve(x+${b})).then(v=>console.log(v))`; // flatten settled
    if (k === 13) return `Promise.resolve(${a}).then(x=>Promise.resolve(x).then(y=>y+${b})).then(v=>console.log(v))`; // flatten pending
    if (k === 14) return `Promise.resolve(${a}).then(x=>x+1).catch(()=>-1).then(x=>console.log(x))`; // catch pass-through
    return `Promise.resolve([${a}]).then(([first,...rest])=>console.log(first,rest.length))`;
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
  if (!fails.length) console.log(`PASS jsint-promisecb: ${checked} promise-callback programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-promisecb: " + f); process.exit(1); }
