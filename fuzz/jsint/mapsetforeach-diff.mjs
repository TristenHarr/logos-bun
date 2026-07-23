// fuzz/jsint/mapsetforeach — Map.prototype.forEach(cb(value,key)) / Set.prototype.forEach(cb(value,
// value)). Previously neither iterated (the generic forEach was array-only). Now they invoke the
// callback per entry (mirrors arrForEach — heap-mutating callbacks like arr.push persist; scalar
// accumulation does not, same as arrays, so this fuzzer uses the heap-push pattern). Diffed vs Node.
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
  const el = () => 1 + ri(8);
  const program = () => {
    const k = ri(5), a = el(), b = el(), c = el();
    if (k === 0) return `let s=new Set([${a},${b},${c}]);let r=[];s.forEach(x=>r.push(x));r.join(",")`;
    if (k === 1) return `let s=new Set([${a},${b}]);let r=[];s.forEach(v=>r.push(v*2));r.join(",")`;
    if (k === 2) return `let m=new Map([["a",${a}],["b",${b}]]);let r=[];m.forEach((v,k)=>r.push(k+v));r.join(",")`;
    if (k === 3) return `let m=new Map([["x",${a}],["y",${b}]]);let r=[];m.forEach(v=>r.push(v));r.join(",")`;
    return `let s=new Set([${a},${b},${c}]);let r=[];s.forEach(x=>{if(x>3)r.push(x)});r.join(",")`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(nodeRun(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-mapsetforeach: ${checked} Map/Set forEach programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-mapsetforeach: " + f); process.exit(1); }
