// fuzz/jsint/whilecond — a while condition containing parentheses (a nested group (a+b), a method or
// function call f()/x.length/Math.floor(...)). execWhile extracted the condition with a naive
// first-`)` scan, truncating any condition with an inner `(`/`)` (so `while(Math.floor(n/2)>0)` /
// `while((i+1)<n)` mis-evaluated or looped forever). It now uses the same balanced-paren extractor as
// execIf/loopBody. Braced bodies with paren conditions are the focus; diffed vs Node.
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "wc-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 100), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const lim = 2 + ri(6), k = ri(6);
    if (k === 0) return `let i=0,s=0;while((i+1)<=${lim}){s+=i;i++}console.log(s)`;
    if (k === 1) return `let n=${8 + ri(56)},c=0;while(Math.floor(n/2)>0){n=Math.floor(n/2);c++}console.log(c)`;
    if (k === 2) return `let a=[${Array.from({length:lim},(_,i)=>i).join(",")}],i=0,s=0;while(i<a.length){s+=a[i];i++}console.log(s)`;
    if (k === 3) return `let q=[${Array.from({length:lim},(_,i)=>i).join(",")}];while(q.length>0){q.pop()}console.log(q.length)`;
    if (k === 4) return `let i=0;while((i*2)<${lim*2}){i++}console.log(i)`;
    return `let x=${2 ** (1 + ri(5))};let c=0;while(x>1){x=Math.floor(x/2);c++}console.log(c)`;
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
  if (!fails.length) console.log(`PASS jsint-whilecond: ${checked} paren-condition while programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-whilecond: " + f); process.exit(1); }
