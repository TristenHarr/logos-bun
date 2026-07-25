// fuzz/jsint/flagbox — a closure mutating an outer scalar, then reading it, for NON-number scalars and
// through call-arg / if() reads. A captured mutable scalar is heap-boxed ({v:…}) so writes persist, but
// two bugs dropped that: (1) scalarDeclName only boxed NUMBER-initialised scalars, so let done=false;
// f=()=>{done=true} lost the write; (2) usedAsParam misread a call/if argument f(x)/if(x)/String(x) as a
// parameter list and vetoed boxing, so reading the flag through a call returned the stale initial value.
// Now primitive inits (number/boolean/null/undefined/string) box, and paramScan only treats `(x)` as a
// param when it is a real param list (function-preceded, or its `)` is followed by `=>`). Diffed vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const run = (p) => { const r = spawnSync(OURS, ["__js", p], { encoding: "utf8" }); return r.status !== 0 ? `ERR:${r.status}` : (r.stdout || "").replace(/\n$/, ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 260), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const k = ri(9);
    if (k === 0) return `let done=false;let f=()=>{done=true};f();String(done)`;
    if (k === 1) return `let done=false;let f=()=>{done=true};f();let r;if(done){r="y"}else{r="n"}r`;
    if (k === 2) return `let s="idle";let go=()=>{s="run"};go();s`;
    if (k === 3) return `let d=null;let f=()=>{d=${1 + ri(9)}};f();d`;
    if (k === 4) return `let ok=true;let clr=()=>{ok=false};clr();Boolean(ok)`;
    if (k === 5) return `let c=0;let f=()=>{c=${1 + ri(9)}};f();Math.max(c,0)`;
    if (k === 6) return `let ready=false;let setup=()=>{ready=true;return 1};let cache;let g=()=>cache??(cache=setup());g();g();ready?"ok":"no"`;
    // regressions: real params must NOT be boxed
    if (k === 7) return `let add=(a,b)=>a+b;add(${1 + ri(9)},${1 + ri(9)})`;
    return `let curry=fn=>a=>b=>fn(a,b);curry((a,b)=>a+b)(${1 + ri(9)})(${1 + ri(9)})`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String((0, eval)(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-flagbox: ${checked} captured-flag programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-flagbox: " + f); process.exit(1); }
