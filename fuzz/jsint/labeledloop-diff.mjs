// fuzz/jsint/labeledloop — labeled loops with `break LABEL` / `continue LABEL` that cross loop levels.
// Two bugs: labeled loops weren't recognized (label prefix → loop no-op'd), and break/continue only
// ever targeted the innermost loop. Fixed by a labeled-loop dispatch (moved to the TOP of execStmt so
// needsIncDec doesn't mangle the header's `i++`) plus a label carried on the break/continue flag and
// matched per loop (flagMatchesHere), propagating to the outer labeled loop when it doesn't match.
// Plain (unlabeled) break/continue are the regression guards. 4s timeout so a regressed hang surfaces.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const run = (p) => { const r = spawnSync(OURS, ["__js", p], { encoding: "utf8", timeout: 4000 }); return r.status !== 0 ? `ERR:${r.status}` : (r.stdout || "").replace(/\n$/, ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 400), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const k = ri(7);
    if (k === 0) { const b = ri(5); return `(function(){ let s=0; L:for(let i=0;i<5;i++){if(i==${b})break L; s+=i} return s })()`; }
    if (k === 1) { const c = ri(3); return `(function(){ let s=0; outer:for(let i=0;i<3;i++){for(let j=0;j<3;j++){if(j==${c})continue outer; s++}} return s })()`; }
    if (k === 2) { const bi = ri(3); return `(function(){ let s=0; outer:for(let i=0;i<3;i++){for(let j=0;j<3;j++){if(i==${bi})break outer; s++}} return s })()`; }
    if (k === 3) { const b = ri(6); return `(function(){ let s=0,i=0; L:while(i<6){i++; if(i==${b})break L; s+=i} return s })()`; }
    if (k === 4) { const b = ri(4); return `(function(){ let s=0; L:for(let v of [1,2,3,4]){if(v==${b})break L; s+=v} return s })()`; }
    if (k === 5) { const b = ri(3); return `(function(){ let s=0; for(let i=0;i<5;i++){if(i==${b})break; s+=i} return s })()`; }         // plain break (guard)
    return `(function(){ let s=0; for(let i=0;i<5;i++){if(i%2)continue; s+=i} return s })()`;                                          // plain continue (guard)
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-labeledloop: ${checked} labeled-loop programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-labeledloop: " + f); process.exit(1); }
