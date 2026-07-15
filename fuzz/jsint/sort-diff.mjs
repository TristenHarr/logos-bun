// fuzz/jsint/sort-diff — Array.prototype.sort: with a comparator (a,b)=>… (ascending
// a-b, descending b-a, string-length, etc.) and the DEFAULT sort, which in JS is
// LEXICOGRAPHIC on String(x) — the famous [10,2,1].sort()===[1,10,2] gotcha, which
// our engine reproduces. Tested both as an expression (returns the sorted array,
// chains) and as an in-place STATEMENT (a.sort(); then observe a). Diffed vs Node.
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
  const nums = () => { const len = 2 + ri(6); const a = []; for (let i = 0; i < len; i++) a.push(1 + ri(99)); return `[${a.join(",")}]`; };
  const words = () => { const pool = ["pear", "fig", "kiwi", "apple", "date", "plum", "lime"]; const len = 2 + ri(4); const a = []; for (let i = 0; i < len; i++) a.push(`"${pool[ri(pool.length)]}"`); return `[${a.join(",")}]`; };
  const program = () => {
    const k = ri(7);
    if (k === 0) return `${nums()}.sort((a,b)=>a-b).join(",")`;          // ascending expression
    if (k === 1) return `${nums()}.sort((a,b)=>b-a).join(",")`;          // descending expression
    if (k === 2) return `${nums()}.sort().join(",")`;                    // DEFAULT lexicographic (the gotcha)
    if (k === 3) return `${words()}.sort().join(",")`;                   // default on strings = natural
    if (k === 4) return `let a=${nums()};a.sort((x,y)=>x-y);a.join(",")`; // in-place statement
    if (k === 5) return `let a=${nums()};a.sort((x,y)=>x-y);a[0]`;        // in-place then index
    return `${nums()}.sort((a,b)=>a-b).map(x=>x*2).join(",")`;           // sort then map (chain)
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
  if (!fails.length) console.log(`PASS jsint-sort: ${checked} sort programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-sort: " + f); process.exit(1); }
