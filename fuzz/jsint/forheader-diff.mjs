// fuzz/jsint/forheader — a C-style for header whose clauses contain parentheses: a call in the
// condition `for(;i<big();)` / `for(let i=0;i<f();i++)`, a call in the update `for(...;i=inc(i))`, a
// grouped condition `(i*i)<n`, or calls in init `for(let i=Math.max(0,1);...)`. execFor/forStmt
// extracted the header with a naive first-`)` scan, truncating it so the `;`-split produced < 3 clauses
// and `item 3` (the update) PANICKED with index-out-of-bounds. The header is now taken with balancedArg.
// Diffed vs Node via a module file.
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "fh-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 100), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const lim = 2 + ri(6), k = ri(7);
    if (k === 0) return `function big(){return ${lim}}let out=[];for(let i=0;i<big();i++)out.push(i);console.log(out.join(","))`;
    if (k === 1) return `function big(){return ${lim}}let i=0;for(;i<big();)i++;console.log(i)`;
    if (k === 2) return `function inc(x){return x+1}let out=[];for(let i=0;i<${lim};i=inc(i))out.push(i);console.log(out.join(","))`;
    if (k === 3) return `let out=[];for(let i=0;(i*i)<${lim*lim};i++)out.push(i);console.log(out.join(","))`;
    if (k === 4) return `let out=[];for(let i=Math.max(0,1);i<Math.min(9,${lim});i++)out.push(i);console.log(out.join(","))`;
    if (k === 5) return `let o={n:${lim}},out=[];for(let i=0;i<o.n;i++)out.push(i);console.log(out.join(","))`;
    return `let out=[];for(let i=0;i<${lim};i++)out.push(i);console.log(out.join(","))`;      // regression: plain
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
  if (!fails.length) console.log(`PASS jsint-forheader: ${checked} for-header programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-forheader: " + f); process.exit(1); }
