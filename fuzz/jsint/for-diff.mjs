// fuzz/jsint/for-diff — the P7 JS engine running FOR loops (desugared to while
// with the init/cond/update triple + brace-aware header splitting), differential-
// fuzzed vs Node eval. Covers accumulator for-loops, for-with-if bodies, nested
// for, and for inside a function. Integer-exact, bounded so loops terminate.
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
const nodeRun = (p) => { const parts = p.split(";"); const body = parts.slice(0, -1).map((s) => s + ";").join("") + " return (" + parts[parts.length - 1] + ");"; return eval("(()=>{" + body + "})()"); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 700), rnd = mul(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const program = () => {
    const N = 2 + Math.floor(rnd() * 8), op = pick(["+", "*", "-"]), acc0 = Math.floor(rnd() * 4);
    const k = rnd();
    if (k < 0.4) return `let acc=${acc0};for(let i=1;i<=${N};i=i+1){acc=acc${op}i};acc`;
    if (k < 0.6) { const m = 1 + Math.floor(rnd() * 3); return `let acc=${acc0};for(let i=0;i<${N};i=i+1){if(i%${m}==0){acc=acc+i}};acc`; }
    if (k < 0.8) { const M = 2 + Math.floor(rnd() * 4); return `let acc=0;for(let i=0;i<${N};i=i+1){for(let j=0;j<${M};j=j+1){acc=acc+1}};acc`; }
    return `function f(n){let s=${acc0};for(let i=1;i<=n;i=i+1){s=s${op}i};return s};f(${N})`;
  };
  let checked = 0;
  for (let i = 0; i < n; i++) {
    const p = program();
    let ref; try { ref = nodeRun(p); } catch { continue; }
    if (typeof ref === "number" && (!Number.isInteger(ref) || Math.abs(ref) > 1e15)) continue;
    ref = String(ref);
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${got} node=${ref}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-for: ${checked} for-loop programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL jsint-for: " + f); process.exit(1); }
