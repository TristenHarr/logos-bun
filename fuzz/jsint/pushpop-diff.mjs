// fuzz/jsint/pushpop-diff — array MUTATION: build arrays imperatively with
// `a.push(x)` (in classic-for and for-of loops, with conditionals and expression
// args) and shrink them with `a.pop()`, then observe via .join/.length/.map. Each
// program runs through logos-bun __js AND Node eval and must agree. Also exercises
// the empty array literal `[]` (which push starts from).
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
  const sn = () => 1 + ri(9);
  const lit = () => "[" + Array.from({ length: 2 + ri(4) }, () => sn()).join(",") + "]";
  const program = () => {
    const k = ri(7);
    if (k === 0) return `let a=[];for(let i=0;i<${2 + ri(4)};i++){a.push(i*i)};a.join(",")`;
    if (k === 1) return `let a=[];for(const x of ${lit()}){a.push(x*2)};a.join("-")`;
    if (k === 2) { const th = sn(); return `let a=[];for(const x of ${lit()}){if(x>${th}){a.push(x)}};a.length`; }
    if (k === 3) return `let a=${lit()};a.pop();a.pop();a.join(",")`;
    if (k === 4) return `let a=[];a.push(${sn()});a.push(${sn()}+${sn()});a.push(${sn()}*2);a.join(",")`;
    if (k === 5) return `let a=[];for(const x of ${lit()}){a.push(x)};a.map(v=>v+1).join(",")`;
    return `let a=${lit()};a.push(${sn()});a.pop();a.length`;
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
  if (!fails.length) console.log(`PASS jsint-pushpop: ${checked} push/pop programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-pushpop: " + f); process.exit(1); }
