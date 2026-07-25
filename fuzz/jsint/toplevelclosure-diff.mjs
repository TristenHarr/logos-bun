// fuzz/jsint/toplevelclosure — the scalar-closure heap-boxing (a captured mutable let/var becomes a
// shared {v:…} cell) ran only inside function bodies (runBlockStr), not for the TOP-LEVEL program
// (jsRun), so a top-level `let c=0; const inc=()=>c++; inc(); inc(); c` stayed 0. jsRun now applies the
// same boxCaptured pass to the top-level statements. Exercises pre/post inc-dec, compound assign, outer
// updates seen by the closure, function-declaration closures and an array of closures over one counter;
// non-captured lets are regressions. Diffed vs Node.
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
  const program = () => {
    const a = ri(20), b = 1 + ri(6), k = ri(9);
    if (k === 0) return `let c=${a};const inc=()=>++c;${"inc();".repeat(b)}c`;
    if (k === 1) return `let c=${a};const inc=()=>c++;${"inc();".repeat(b)}c`;
    if (k === 2) return `let c=${a};const dec=()=>--c;${"dec();".repeat(b)}c`;
    if (k === 3) return `let c=${a};const f=()=>{c+=${b}};f();f();c`;
    if (k === 4) return `let c=${a};const get=()=>c;c=${a + b};get()`;
    if (k === 5) return `let count=0;function tick(){count++}${"tick();".repeat(b)}count`;
    if (k === 6) return `let n=${a};const fns=[()=>n++,()=>n++,()=>n++];fns[0]();fns[1]();n`;
    if (k === 7) return `let x=${a};let y=${b};x+y`;                            // regression: non-captured
    return `let s=0;[${Array.from({ length: b }, (_, i) => i + 1)}].forEach(x=>s+=x);s`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String((0, eval)(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-toplevelclosure: ${checked} top-level-closure programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-toplevelclosure: " + f); process.exit(1); }
