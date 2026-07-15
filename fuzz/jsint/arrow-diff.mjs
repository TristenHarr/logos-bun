// fuzz/jsint/arrow-diff — ARROW FUNCTIONS: random arrow forms (single-param,
// paren-params, no-params, expression body, block body, curried, and arrows
// passed to map/filter) each run through logos-bun __js AND Node eval and
// required to agree. Arrows are desugared to the engine's existing
// `function(params){...}` form in normalizeJs, so this also re-checks closures.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 600), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const sn = () => 1 + ri(9);                       // 1..9 (keep arithmetic small/positive)
  const binop = () => ["+", "-", "*"][ri(3)];
  const arr = () => "[" + Array.from({ length: 2 + ri(4) }, () => sn()).join(",") + "]";
  const program = () => {
    const k = ri(9);
    if (k === 0) { const a = sn(); return `let f=x=>x${binop()}${a};f(${sn()})`; }
    if (k === 1) { const a = sn(); return `let f=(p,q)=>p${binop()}q${binop()}${a};f(${sn()},${sn()})`; }
    if (k === 2) { const a = sn(); return `let f=()=>${a}${binop()}${sn()};f()`; }
    if (k === 3) { const a = sn(); return `let f=x=>{let y=x${binop()}${a};return y${binop()}${sn()}};f(${sn()})`; }
    if (k === 4) return `let g=a=>b=>a${binop()}b;g(${sn()})(${sn()})`;
    if (k === 5) { const a = sn(); return `let v=${arr()};v.map(x=>x${binop()}${a}).join(",")`; }
    if (k === 6) { const t = sn(); return `let v=${arr()};v.filter(x=>x>${t}).length`; }
    if (k === 7) { const a = sn(); return `let v=${arr()};v.map(x=>x*${a}).filter(x=>x>${sn()}).join("-")`; }
    return `let n=${sn()};let s=x=>x>n?"big":"small";s(${sn()})`;   // arrow closing over outer var (value capture)
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
  if (!fails.length) console.log(`PASS jsint-arrow: ${checked} arrow-function programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-arrow: " + f); process.exit(1); }
