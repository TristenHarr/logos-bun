// fuzz/jsint/reduceempty — [].reduce(fn) / [].reduceRight(fn) with NO initial value throws a TypeError
// ("Reduce of empty array with no initial value"). It used to return undefined silently. With an initial
// value, or a non-empty array, or a single element, it does NOT throw. Diffed vs Node (`bun run`).
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "re-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const arr = () => "[" + Array.from({ length: ri(4) }, () => ri(9)).join(",") + "]";
  const m = () => (ri(2) ? "reduce" : "reduceRight");
  const program = () => {
    const k = ri(6);
    // guard prints e.name+"|"+e.message on throw, else the value
    if (k === 0) return `try{console.log("v="+[].${m()}((a,b)=>a+b))}catch(e){console.log(e.name+"|"+e.message)}`;
    if (k === 1) return `try{console.log("v="+[].${m()}((a,b)=>a+b,${ri(9)}))}catch(e){console.log("err")}`;   // with init: no throw
    if (k === 2) return `try{console.log("v="+${arr()}.${m()}((a,b)=>a+b))}catch(e){console.log(e.name)}`;      // maybe empty (ri(4) can be 0)
    if (k === 3) return `try{console.log("v="+[${ri(9)}].${m()}((a,b)=>a+b))}catch(e){console.log(e.name)}`;    // single: no throw
    if (k === 4) return `try{console.log("v="+[1,2,3,4,5].filter(x=>x>${5 + ri(6)}).${m()}((a,b)=>a+b))}catch(e){console.log(e.name)}`;  // filtered maybe empty
    return `try{console.log("v="+${arr()}.${m()}((a,b)=>a*b,1))}catch(e){console.log("err")}`;                   // with init
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
  if (!fails.length) console.log(`PASS jsint-reduceempty: ${checked} reduce-empty programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-reduceempty: " + f); process.exit(1); }
