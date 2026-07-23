// fuzz/jsint/emptyfor — a for-loop with an EMPTY condition (`for (init;;update)` / `for (;;)`) is
// always-true and runs until an inner break/return. The empty middle clause evaluated to false, so the
// loop never ran (→ NaN). Fixed by forCondHolds (empty condition ⇒ true). Normal for-loops (with a
// condition) are the regression guards. 4s per-run timeout so a regressed infinite loop surfaces.
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
    const k = ri(6);
    const lim = 2 + ri(6);
    if (k === 0) return `(function(){ for(let i=0;;i++){ if(i>${lim}) return i } })()`;
    if (k === 1) return `(function(){ let s=0; for(let i=0;;i++){ if(i>=${lim}) break; s+=i } return s })()`;
    if (k === 2) return `(function(){ let n=0; for(;;){ n++; if(n>=${lim}) break } return n })()`;
    if (k === 3) return `(function(){ let i=0; for(;i<${lim};){ i++ } return i })()`;                       // empty init+update
    if (k === 4) return `(function(){ let s=0; for(let i=0;i<${lim};i++){ s+=i } return s })()`;             // normal (guard)
    return `(function(){ let s=0; for(let i=0;i<${lim};i++) s+=i; return s })()`;                            // normal braceless (guard)
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-emptyfor: ${checked} empty-for programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-emptyfor: " + f); process.exit(1); }
