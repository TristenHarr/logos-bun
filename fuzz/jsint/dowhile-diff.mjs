// fuzz/jsint/dowhile — `do { body } while ( cond )` runs the body ONCE before testing the guard
// (so it always executes at least once, even when the guard is false initially). The engine had no
// `do` handler, so the body never ran. Covers accumulation, guard-false-first, break, and continue
// (which jumps to the guard). Random programs diffed vs Node.
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
const nodeRun = (p) => {
  let depth = 0, parts = [], cur = "";
  for (const c of p) { if (c === "{" || c === "(" || c === "[") depth++; else if (c === "}" || c === ")" || c === "]") depth--; if (c === ";" && depth === 0) { parts.push(cur); cur = ""; } else cur += c; }
  parts.push(cur);
  const body = parts.slice(0, -1).map((s) => s + ";").join("") + " return (" + parts[parts.length - 1] + ");";
  return eval("(()=>{" + body + "})()");
};
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const lim = () => 1 + ri(6);
  const program = () => {
    const k = ri(6);
    if (k === 0) return `let n=0;do{n=n+1}while(n<${lim()});n`;
    if (k === 1) return `let n=${5 + ri(5)};do{n=n+1}while(n<${lim()});n`;         // guard false first, runs once
    if (k === 2) { const L = lim(); return `let s="";let i=0;do{s=s+i;i=i+1}while(i<${L});s`; }
    if (k === 3) { const B = 1 + ri(5); return `let n=0;do{n=n+1;if(n===${B})break}while(n<20);n`; }
    if (k === 4) { const L = 2 + ri(4); return `let c=0;let i=0;do{i=i+1;if(i===2)continue;c=c+i}while(i<${L});c`; }
    return `let p=1;let i=0;do{i=i+1;p=p*2}while(i<${1 + ri(5)});p`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(nodeRun(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-dowhile: ${checked} do-while programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-dowhile: " + f); process.exit(1); }
