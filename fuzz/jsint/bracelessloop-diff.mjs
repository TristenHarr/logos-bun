// fuzz/jsint/bracelessloop — a loop whose body is a single BRACELESS statement (`for (…) f();`,
// `while (c) x++;`, `for (const v of xs) s+=v;`). Every loop executor extracted its body as the first
// `{ … }` block, so a braceless body was empty: the loop no-op'd, and a `while` whose update lives in
// the (missing) body HUNG. Fixed by loopBody, which locates the body after the header's matching `)`
// and takes the braced content OR the lone trailing statement. Braced loops are the regression guard.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// 4s cap so a regressed hang shows as a timeout, not a stuck fuzzer
const run = (p) => { const r = spawnSync(OURS, ["__js", p], { encoding: "utf8", timeout: 4000 }); return r.status !== 0 ? `ERR:${r.status}` : (r.stdout || "").replace(/\n$/, ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 400), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const k = ri(7);
    if (k === 0) { const m = 2 + ri(5); return `(function(){ let s=0; for(let i=0;i<${m};i++) s+=i; return s })()`; }
    if (k === 1) { const arr = Array.from({ length: 1 + ri(4) }, () => ri(9)); return `(function(){ let s=0; for(let v of [${arr.join(",")}]) s+=v; return s })()`; }
    if (k === 2) return `(function(){ let o={a:${ri(9)},b:${ri(9)},c:${ri(9)}}; let s=""; for(let k in o) s+=k; return s })()`;
    if (k === 3) { const m = 2 + ri(5); return `(function(){ let i=0,s=0; while(i<${m}) s+=i++; return s })()`; }
    if (k === 4) { const m = 2 + ri(6); return `(function(){ let s=0; for(let i=0;i<${m};i++) if(i%2) s+=i; return s })()`; } // braceless if inside braceless for
    if (k === 5) { const m = 2 + ri(4); return `(function(){ let s=0; for(let i=0;i<${m};i++){s+=i} return s })()`; }        // braced (guard)
    const arr = Array.from({ length: 1 + ri(4) }, () => ri(9)); return `(function(){ let s=0; for(let v of [${arr.join(",")}]){s+=v} return s })()`; // braced for-of (guard)
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-bracelessloop: ${checked} braceless-loop programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-bracelessloop: " + f); process.exit(1); }
