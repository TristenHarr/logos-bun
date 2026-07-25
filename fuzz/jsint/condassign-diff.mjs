// fuzz/jsint/condassign — a scalar assignment inside an if/while CONDITION now persists. A bare
// `while(m = expr)` / `if(x = expr)` and the parenthesized `while((m = expr) !== null)` /
// `while((i = i + 1) <= n)` forms run the assignment as a STATEMENT (so the scalar write survives —
// expression-position writes were dropped) and then test the variable, powering the ubiquitous
// `while(m = re.exec(s))` iteration and counter loops. Conditions WITHOUT an assignment (a nested group
// `(i+1)<n`, a call `(a.length)>0`) must be unchanged. Diffed vs Node via a module file.
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "ca-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 100), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const lim = 2 + ri(6), v = 1 + ri(20), k = ri(8);
    if (k === 0) return `let m;if(m=${v})console.log(m); else console.log("no")`;
    if (k === 1) return `let i=0,s=0;while((i=i+1)<=${lim})s+=i;console.log(s)`;
    if (k === 2) return `const re=/(\\d+)/g;let m,out=[];while(m=re.exec("a1b22c333"))out.push(m[1]);console.log(out.join(","))`;
    if (k === 3) return `const re=/(\\d)/g;let m,out=[];while((m=re.exec("x1y2z3"))!==null)out.push(m[1]);console.log(out.join(","))`;
    if (k === 4) return `let x,r=[],i=0;while((x=i++)<${lim})r.push(x);console.log(r.join(","))`;
    if (k === 5) return `let node={v:1,next:{v:2,next:{v:3,next:null}}},cur,s=0;cur=node;while(cur){s+=cur.v;cur=cur.next}console.log(s)`;
    if (k === 6) return `let i=0,s=0;while((i+1)<=${lim}){s+=i;i++}console.log(s)`;         // regression: paren no-assign
    return `let a=[${Array.from({length:lim},(_,i)=>i).join(",")}];if((a.length)>1)console.log("many");else console.log("few")`; // regression: call in paren
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
  if (!fails.length) console.log(`PASS jsint-condassign: ${checked} condition-assignment programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-condassign: " + f); process.exit(1); }
