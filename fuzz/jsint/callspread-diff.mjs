// fuzz/jsint/callspread-diff — CALL spread f(...args): a `...arr` argument in a
// call to a user function expands to that array's elements as positional arguments,
// mixable with fixed args and multiple spreads. Random such calls (to arrow /
// function-expression callees) run through logos-bun __js AND Node eval, required
// to agree. (Math.max(...arr) needs variadic Math + method-path spread — a follow-up.)
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const sn = () => 1 + ri(9);
  const program = () => {
    const k = ri(5);
    if (k === 0) return `let f=(a,b,c)=>a+b+c;let xs=[${sn()},${sn()},${sn()}];f(...xs)`;
    if (k === 1) return `let f=(a,b,c)=>a*100+b*10+c;let t=[${sn()},${sn()}];f(${sn()},...t)`;
    if (k === 2) return `let f=(a,b,c)=>a+b+c;let m=[${sn()}];f(${sn()},...m,${sn()})`;
    if (k === 3) return `let f=(a,b,c,d)=>a+b+c+d;let p=[${sn()},${sn()}];let q=[${sn()},${sn()}];f(...p,...q)`;
    return `let sum=(a,b,c)=>a+b+c;let xs=[1,2,3].map(x=>x*${sn()});sum(...xs)`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = nodeRun(p); } catch { continue; }
    ref = String(ref);
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-callspread: ${checked} call-spread programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-callspread: " + f); process.exit(1); }
