// fuzz/jsint/callfromindex-diff — calling a function stored in an array element or a computed property:
// `arr[i]()`, `arr[i](args)`, `obj[key]()`. resolveCalls only recognized a callee that was a bare
// variable NAME (envGet(lastTok)); an index expression like `a[0]` (lastTok `]`) was never invoked, so it
// leaked the raw function body. This surfaced as the "HOF callback returning a function" symptom
// (`[1,2,3].map(x=>()=>x*10); fns[1]()`) — which is really `arr[i]()`, not a closure bug. Fixed by
// resolving the callee's boundary with recvStart/joinRange (matching the `]` group) and calling the
// resulting fn value. Plain index reads and method calls are re-checked. Diffed vs Node.
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
const dir = mkdtempSync(join(tmpdir(), "cfi-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 200), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = 1 + ri(9), b = 1 + ri(9), i = ri(2);
    const k = ri(7);
    if (k === 0) return `let a=[function(){return ${a};},function(){return ${b};}];console.log(a[${i}]());`;
    if (k === 1) return `let a=[()=>${a},()=>${b}];console.log(a[${i}]());`;
    if (k === 2) return `let a=[x=>x*${a}];console.log(a[0](${b}));`;
    if (k === 3) return `let fns=[1,2,3].map(x=>()=>x*${a});console.log(fns[${i}]());`;
    if (k === 4) return `let fns=[1,2,3].map(x=>y=>x+y);console.log(fns[${i}](${b}));`;
    if (k === 5) return `let ops={add:(p,q)=>p+q,mul:(p,q)=>p*q};let ns=["add","mul"];console.log(ops[ns[${i}]](${a},${b}));`;
    return `let a=[${a},${b},${a + b}];console.log(a[${i}]+a[2]);`;  // plain index read regression
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src), got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-callfromindex: ${checked} index-call programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-callfromindex: " + f); process.exit(1); }
