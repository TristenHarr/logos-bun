// fuzz/jsint/flatmap-diff — Array.flatMap: map each element then flatten ONE level.
// arrFlatMap composes arrMap + arrFlat. Also exercises the refactored leftmostMethod
// (flat marker-list fold replacing the deeply-nested betterMarker chain that hit the
// LOGOS AST depth ceiling — dispatch must stay leftmost-correct across chains). Diffed
// vs Node.
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
  const sn = () => 1 + ri(9);
  const arr = () => { const a = Array.from({ length: 2 + ri(4) }, () => sn()); return `[${a.join(",")}]`; };
  const program = () => {
    const k = ri(6);
    if (k === 0) return `${arr()}.flatMap(x=>[x,x*2]).join(",")`;              // duplicate-expand
    if (k === 1) return `${arr()}.flatMap(x=>[x]).join(",")`;                  // identity flatten
    if (k === 2) return `${arr()}.flatMap(x=>x+${sn()}).join(",")`;            // scalar (flatMap flattens scalars)
    if (k === 3) return `${arr()}.flatMap(x=>[x,x]).map(y=>y+1).join("-")`;    // flatMap then map (chain)
    if (k === 4) { const words = ["a b", "c d", "e f", "g"]; const w = Array.from({ length: 2 + ri(2) }, () => words[ri(words.length)]); return `[${w.map((x) => JSON.stringify(x)).join(",")}].flatMap(s=>s.split(" ")).join(",")`; } // split-expand
    return `${arr()}.filter(x=>x>${1 + ri(4)}).flatMap(x=>[x,x*10]).join(",")`; // filter then flatMap
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
  if (!fails.length) console.log(`PASS jsint-flatmap: ${checked} flatMap programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-flatmap: " + f); process.exit(1); }
