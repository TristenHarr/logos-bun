// fuzz/jsint/reassignbox — an array/object-literal var REASSIGNED inside a closure (the immutable-update
// pattern: let stack=[]; const push=x=>stack=[...stack,x]; or let state={n:0}; inc=()=>state={n:state.n+1}).
// Boxing only promoted scalars with a literal init, so an array/object-init var wasn't boxed and the
// reassignment in the closure was lost. It is now boxed ONLY when reassigned (bare `X=`) and never
// bracket-accessed — so a member-WRITE var (let m={}; m[k]=v — which persists via the heap ref unboxed)
// is deliberately NOT boxed (that path mishandles the nested m.v[k] write). Diffed vs Node (`bun run`);
// member-write / method-mutation / plain-array cases are the regression controls.
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "rb-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = 1 + ri(9), b = 1 + ri(9), k = ri(7);
    if (k === 0) return `let stack=[];const push=x=>stack=[...stack,x];${Array.from({length:1+ri(4)},(_,i)=>`push(${i});`).join("")}console.log(stack.join(","))`;
    if (k === 1) return `let state={n:0};const inc=()=>state={n:state.n+1};inc();inc();inc();console.log(state.n)`;
    if (k === 2) return `let acc=[];[${a},${b}].forEach(x=>acc=acc.concat(x*2));console.log(acc.join(","))`;
    if (k === 3) return `let m={};const set=(k,v)=>{m[k]=v};set("a",${a});set("b",${b});console.log(m.a,m.b)`;              // regression: member write
    if (k === 4) return `let arr=[];const add=x=>{arr.push(x)};add(${a});add(${b});console.log(arr.join(","))`;            // regression: method mutation
    if (k === 5) return `let a=[1,2,3];a[0]=${a};console.log(a.join(","))`;                                                 // regression: index write
    return `const nums=[${a},${b}];console.log(nums.map(x=>x*2).join(","))`;                                               // regression: plain array
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
  if (!fails.length) console.log(`PASS jsint-reassignbox: ${checked} reassign-box programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-reassignbox: " + f); process.exit(1); }
