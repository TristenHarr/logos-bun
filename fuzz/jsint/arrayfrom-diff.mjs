// fuzz/jsint/arrayfrom-diff — Array.from + Array.of construction. Array.from over an
// array (copy), a string (char array), or an array-like {length:n} ([undefined]×n),
// with an optional (element, index) mapFn — the range idiom Array.from({length:n},
// (_,i)=>expr). callFnIdx binds the element and, only if the mapFn has a 2nd param,
// the index (so both x=>… and (_,i)=>… work). Array.of(...) is the variadic literal.
// Diffed vs Node.
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
  const program = () => {
    const k = ri(8);
    if (k === 0) { const len = 1 + ri(6); return `Array.from({length:${len}},(_,i)=>i).join(",")`; }
    if (k === 1) { const len = 1 + ri(6); const m = 1 + ri(4); return `Array.from({length:${len}},(_,i)=>i*${m}).join(",")`; }
    if (k === 2) { const arr = Array.from({ length: 2 + ri(4) }, () => sn()); return `Array.from([${arr.join(",")}]).join("-")`; }
    if (k === 3) { const arr = Array.from({ length: 2 + ri(4) }, () => sn()); return `Array.from([${arr.join(",")}],x=>x+${sn()}).join(",")`; }
    if (k === 4) { const args = Array.from({ length: 1 + ri(4) }, () => sn()); return `Array.of(${args.join(",")}).join(",")`; }
    if (k === 5) { const len = 1 + ri(5); return `Array.from({length:${len}}).length`; }
    if (k === 6) { const w = ["abc", "hi", "logos", "bun", "xy"][ri(5)]; return `Array.from(${JSON.stringify(w)}).length`; }
    const len = 1 + ri(5); return `Array.from({length:${len}},(_,i)=>i+1).reduce((a,b)=>a+b,0)`;
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
  if (!fails.length) console.log(`PASS jsint-arrayfrom: ${checked} Array.from/of programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-arrayfrom: " + f); process.exit(1); }
