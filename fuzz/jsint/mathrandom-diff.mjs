// fuzz/jsint/mathrandom — Math.random() returns a real number in [0, 1) (via the toolchain's
// randomFloat, non-deterministic like Node). Its exact value can't be diffed, so every program here
// reduces the random draw to a DETERMINISTIC boolean/label that must hold for any value in range
// (in [0,1), typeof number, floor(r*k) in [0,k), r+r in [0,2), etc.). Those labels are diffed vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 300), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const k = 1 + ri(20);
    const j = ri(8);
    if (j === 0) return `Math.random()>=0&&Math.random()<1?"in":"out"`;
    if (j === 1) return `typeof Math.random()`;
    if (j === 2) return `(()=>{const f=Math.floor(Math.random()*${k});return f>=0&&f<${k}?"ok":"bad"})()`;
    if (j === 3) return `(()=>{const r=Math.random();return r+r>=0&&r+r<2?"ok":"bad"})()`;
    if (j === 4) return `Number.isFinite(Math.random())?"fin":"inf"`;
    if (j === 5) return `(()=>{const a=[];for(let i=0;i<5;i++)a.push(Math.random()>=0);return a.every(x=>x)?"all":"no"})()`;
    if (j === 6) return `Math.round(Math.random())>=0?"t":"f"`;
    return `(()=>{const r=Math.random()*${k};return r>=0&&r<${k}?"ok":"bad"})()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-mathrandom: ${checked} Math.random property programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-mathrandom: " + f); process.exit(1); }
