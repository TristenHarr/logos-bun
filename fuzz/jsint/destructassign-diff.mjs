// fuzz/jsint/destructassign — array destructuring ASSIGNMENT (not declaration): `[a,b]=[b,a]` (the
// swap idiom), `[a,b,c]=[...]`, rotate, and `[a,...rest]=arr`. The plain-assignment dispatch routed an
// LHS containing `[` to assignTarget (member write), so an array-pattern LHS silently no-op'd. Now an
// LHS that STARTS with `[` is a destructuring target and binds via destructureArr with the RHS
// evaluated first. Member/index writes (`a[i]=v`, `o.x=v`) are the regression guards.
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
    if (k === 0) { const a = ri(9), b = ri(9); return `(function(){ let a=${a},b=${b}; [a,b]=[b,a]; return a+","+b })()`; }
    if (k === 1) { const v = [ri(9), ri(9), ri(9)]; return `(function(){ let a,b,c; [a,b,c]=[${v.join(",")}]; return a+"|"+b+"|"+c })()`; }
    if (k === 2) { const v = [ri(9), ri(9), ri(9)]; return `(function(){ let x=${v[0]},y=${v[1]},z=${v[2]}; [x,y,z]=[z,x,y]; return x+"|"+y+"|"+z })()`; }
    if (k === 3) { const v = [ri(9), ri(9), ri(9), ri(9)]; return `(function(){ let a,rest; [a,...rest]=[${v.join(",")}]; return a+"|"+rest.join(",") })()`; }
    if (k === 4) { const a = ri(9), b = ri(9); return `(function(){ let src=[${a},${b}]; let p,q; [p,q]=src; return p+","+q })()`; }
    // k === 5: REGRESSION — member/index writes must NOT be treated as destructuring
    const v = ri(50);
    return `(function(){ let a=[1,2,3]; a[1]=${v}; let o={x:0}; o.x=${v}; return a[1]+","+o.x })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-destructassign: ${checked} destructuring-assignment programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-destructassign: " + f); process.exit(1); }
