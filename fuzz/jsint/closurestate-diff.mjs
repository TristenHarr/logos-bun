// fuzz/jsint/closurestate — captured-scalar mutation through a closure call, in RUN (file) mode. The
// boxing pass (boxCaptured, which rewrites a captured mutable scalar to a heap cell so the mutation
// persists) was applied only on the __js eval path (jsRun), NOT on the `bun run file.js` path
// (runModuleBody) — so closure counters/flags worked in the __js-mode fuzzers but silently failed in
// real files. runModuleBody now boxes too. This fuzzer runs through `bun run` specifically. Regressions:
// real params and recursion must be untouched. Diffed vs Node.
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "cs-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 100), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = 1 + ri(6), b = 1 + ri(9), k = ri(11);
    if (k === 0) return `let count=0;const inc=()=>count++;${"inc();".repeat(a)}console.log(count)`;
    if (k === 1) return `let done=false;const f=()=>{done=true};f();console.log(String(done))`;
    if (k === 2) return `let c=0;const add=x=>{c+=x};[${Array.from({length:a},(_,i)=>i+1).join(",")}].forEach(add);console.log(c)`;
    if (k === 3) return `let n=${b + 5};const dec=()=>{n--};${"dec();".repeat(a)}console.log(n)`;
    if (k === 4) return `const counter=(()=>{let c=0;return{inc:()=>++c,get:()=>c}})();${"counter.inc();".repeat(a)}console.log(counter.get())`;
    if (k === 5) return `let s="";const app=x=>{s+=x};[${Array.from({length:a},(_,i)=>i).join(",")}].forEach(app);console.log(s)`;
    if (k === 6) return `const mk=(x)=>{let c=x;return()=>c++};const f=mk(${b});console.log(f(),f())`;      // factory: param→mutated local
    if (k === 7) return `function makeAdder(base){let total=base;return n=>{total+=n;return total}}const g=makeAdder(${b});console.log(g(${a}),g(${a}))`;
    if (k === 8) return `const counter=(init=0)=>{let c=init;return{next:()=>c++}};const it=counter(${b});console.log(it.next(),it.next())`;
    if (k === 9) return `const add=(x,y)=>x+y;console.log(add(${a},${b}))`;                 // regression: real params
    return `const fib=n=>n<2?n:fib(n-1)+fib(n-2);console.log(fib(${5 + ri(6)}))`;             // regression: recursion
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
  if (!fails.length) console.log(`PASS jsint-closurestate: ${checked} closure-state programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-closurestate: " + f); process.exit(1); }
