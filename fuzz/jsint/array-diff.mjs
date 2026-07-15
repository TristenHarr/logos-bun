// fuzz/jsint/array-diff — the P7 JS engine's ARRAY value model (literals + index)
// differential-fuzzed vs Node eval. Arrays are a tagged value (chr(5), elements
// chr(6)-joined); [e,e,e] literals and a[i] indexing resolve in an array pass
// parallel to the call pass. Ref uses String(result) (Array.toString), not
// console.log (which prints [ 1, 2, 3 ]).
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 700), rnd = mul(seed);
  const arr = () => { const len = 1 + Math.floor(rnd() * 5); return "[" + Array.from({ length: len }, () => Math.floor(rnd() * 30)).join(",") + "]"; };
  const program = () => {
    const a = arr(), len = a.split(",").length;
    const k = rnd();
    if (k < 0.2) return a;                                                  // literal
    if (k < 0.45) return `let a=${a};a[${Math.floor(rnd() * len)}]`;        // index
    if (k < 0.65) { const i = Math.floor(rnd() * len), j = Math.floor(rnd() * len); return `let a=${a};a[${i}]+a[${j}]`; }
    if (k < 0.72) return `let s=0;let a=${a};for(let i=0;i<${len};i=i+1){s=s+a[i]};s`;  // sum loop
    if (k < 0.82) { const els = a.slice(1, -1).split(",").map(Number); const target = rnd() < 0.7 ? els[Math.floor(rnd() * els.length)] : Math.floor(rnd() * 40); return `let a=${a};a.indexOf(${target})`; } // array indexOf (element-based)
    if (k < 0.86) { const els = a.slice(1, -1).split(",").map(Number); const target = rnd() < 0.7 ? els[Math.floor(rnd() * els.length)] : Math.floor(rnd() * 40); return `let a=${a};a.includes(${target})`; } // array includes
    if (k < 0.9) { const b = 1 + Math.floor(rnd() * len), a0 = Math.floor(rnd() * b); return `let a=${a};a.slice(${a0},${b})`; } // array slice (element sub-array)
    if (k < 0.93) return `let a=${a};a.reverse()`;                          // array reverse
    if (k < 0.97) { const w = Math.floor(rnd() * 9), x = Math.floor(rnd() * 9), y = Math.floor(rnd() * 9), z = Math.floor(rnd() * 9); const i = Math.floor(rnd() * 2), j = Math.floor(rnd() * 2); return `let a=[[${w},${x}],[${y},${z}]];a[${i}][${j}]`; } // NESTED array index
    const i = Math.floor(rnd() * len), j = Math.floor(rnd() * len); return `let a=${a};a[${i}]>a[${j}]?a[${i}]:a[${j}]`; // ternary
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = nodeRun(p); } catch { continue; }
    if (typeof ref === "number" && (!Number.isInteger(ref) || Math.abs(ref) > 1e15)) continue;
    ref = String(ref);
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-array: ${checked} array programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL jsint-array: " + f); process.exit(1); }
