// fuzz/jsint/methods2-diff — commonly-used method completions: String.replaceAll
// (replace EVERY occurrence, vs replace = first only) and Array.findIndex (the index
// of the first element satisfying a predicate, or -1). replaceAll scans the original
// left-to-right (never re-scanning the replacement), findIndex mirrors find. Both
// compose/chain. Diffed vs Node. (Empty search string for replaceAll is scoped out.)
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
  const sep = () => ["-", ".", "/", "o", "a", " ", "x"][ri(7)];
  const word = () => { const pool = ["a", "b", "c", "-", ".", "o", "x", " "]; const len = 3 + ri(6); let s = ""; for (let i = 0; i < len; i++) s += pool[ri(pool.length)]; return s; };
  const program = () => {
    const k = ri(6);
    if (k === 0) { const w = word(), a = sep(), b = sep(); return `${JSON.stringify(w)}.replaceAll(${JSON.stringify(a)},${JSON.stringify(b)})`; }
    if (k === 1) { const w = word(); return `${JSON.stringify(w)}.replaceAll(${JSON.stringify(sep())},"_")`; }
    if (k === 2) { const w = word(); return `${JSON.stringify(w)}.replaceAll(${JSON.stringify(sep())},"").length`; }   // remove all
    if (k === 3) { const arr = Array.from({ length: 3 + ri(5) }, () => sn()); const t = 1 + ri(9); return `[${arr.join(",")}].findIndex(x=>x>${t})`; }
    if (k === 4) { const arr = Array.from({ length: 3 + ri(5) }, () => sn()); const t = 1 + ri(9); return `[${arr.join(",")}].findIndex(x=>x===${t})`; }
    return `${JSON.stringify(word())}.replaceAll(${JSON.stringify(sep())},"#").toUpperCase()`;                          // chain
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
  if (!fails.length) console.log(`PASS jsint-methods2: ${checked} replaceAll/findIndex programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-methods2: " + f); process.exit(1); }
