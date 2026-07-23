// fuzz/jsint/bracelessif — a braceless `if (c) stmt; else stmt2` (and `else if` chains). splitTop keeps
// `; else` together, but execIf extracted the braceless consequent WITH its trailing `;` (`return "a" ;`),
// which corrupted execStmt/jsEvalIn → NaN. Fixed by stripTrailSemi on the consequent and else part.
// Braced if/else and a braceless then with NO else are the regression guards.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 400), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const k = ri(6);
    const x = ri(5);
    if (k === 0) return `(function(){ let x=${x}; if(x==0) return "z"; else if(x==1) return "o"; else return "m" })()`;
    if (k === 1) return `(function(){ let x=${x},r=""; if(x>2) r="big"; else r="small"; return r })()`;
    if (k === 2) return `(function(){ let x=${x},r=""; if(x<0) r="neg"; else if(x==0) r="zero"; else r="pos"; return r })()`;
    if (k === 3) return `(function(){ let s=0; for(let i=0;i<${2 + ri(4)};i++) if(i%2==0) s+=i; else s-=1; return s })()`;
    if (k === 4) return `(function(){ let x=${x}; if(x>2){return "big"}else{return "small"} })()`;               // braced (guard)
    return `(function(){ let x=${x}; if(x>2) return "big"; return "small" })()`;                                  // braceless then, no else (guard)
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-bracelessif: ${checked} braceless-if programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-bracelessif: " + f); process.exit(1); }
