// fuzz/jsint/switch-diff — switch statements: numeric and string discriminants,
// matched cases, default, break, and fall-through (a case with no break flows into
// the next). Random switch programs run through logos-bun __js AND Node eval and
// required to agree.
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
  for (const c of p) {
    if (c === "{" || c === "(" || c === "[") depth++;
    else if (c === "}" || c === ")" || c === "]") depth--;
    if (c === ";" && depth === 0) { parts.push(cur); cur = ""; } else cur += c;
  }
  parts.push(cur);
  const body = parts.slice(0, -1).map((s) => s + ";").join("") + " return (" + parts[parts.length - 1] + ");";
  return eval("(()=>{" + body + "})()");
};
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const k = ri(5);
    if (k === 0) { const x = 1 + ri(4); return `let x=${x};let r="?";switch(x){case 1:r="a";break;case 2:r="b";break;case 3:r="c";break;default:r="d"};r`; }
    if (k === 1) { const x = 1 + ri(4); return `let x=${x};let r="?";switch(x){case 1:r="a";break;case 2:r="b";break};r`; }        // no default
    if (k === 2) { const x = 1 + ri(3); return `let x=${x};let n=0;switch(x){case 1:n=n+1;case 2:n=n+1;break;case 3:n=99};n`; }       // fall-through
    if (k === 3) { const w = ["cat", "dog", "fox", "owl"][ri(4)]; return `let s="${w}";let v=0;switch(s){case "cat":v=1;break;case "dog":v=2;break;default:v=9};v`; }
    { const x = 1 + ri(5); return `let d=0;switch(${x}){case 1:d=10;break;case 5:d=50;break;default:d=-1};d`; }
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
  if (!fails.length) console.log(`PASS jsint-switch: ${checked} switch programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-switch: " + f); process.exit(1); }
