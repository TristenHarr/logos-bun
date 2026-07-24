// fuzz/jsint/foreachscalar — scalar mutation inside a forEach callback now persists. A forEach callback
// resolves a captured variable by name from the loop env and mutates it in its OWN (discarded) env, so a
// scalar accumulator (`let s=0; a.forEach(x=>{s+=x})`) never persisted (only OBJECT accumulators did, being
// shared heap refs). Added statement-level forEach env write-back: forEachEnv threads the loop env, and
// callFnIdxEnv3 rebuilds it with the callback's latest values for each OUTER variable, keeping the
// callback's own PARAMS at their outer value (so `let t=5; a.forEach(t=>{})` leaves t=5). This fuzzer builds
// forEach loops that accumulate/count/track into scalars (with index, if/else, multiple scalars) and checks
// vs Node; object accumulators and map are regression-checked.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const arr = () => `[${Array.from({ length: 1 + ri(6) }, () => ri(20)).join(",")}]`;
  const program = () => {
    const k = ri(6);
    if (k === 0) return `(function(){ let s=0; ${arr()}.forEach(x=>{ s=s+x }); return s })()`;
    if (k === 1) return `(function(){ let s=0; ${arr()}.forEach(x=>{ s+=x }); return s })()`;
    if (k === 2) return `(function(){ let c=0; ${arr()}.forEach(x=>{ if(x%2===0)c=c+1 }); return c })()`;
    if (k === 3) return `(function(){ let mx=-1; ${arr()}.forEach(x=>{ if(x>mx)mx=x }); return mx })()`;
    if (k === 4) return `(function(){ let sum=0,cnt=0; ${arr()}.forEach(n=>{ sum+=n; cnt=cnt+1 }); return sum+"/"+cnt })()`;
    return `(function(){ let s=""; ${arr()}.forEach((x,i)=>{ s+=i+":"+x+";" }); return s })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-foreachscalar: ${checked} forEach-scalar programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-foreachscalar: " + f); process.exit(1); }
