// fuzz/jsint/forin-diff — for...in loops: iterate the enumerable KEYS of an object
// (insertion order, as strings) or the index strings of an array. execFor branches on
// ' in ' in the header; execForIn binds the loop var to each key of forInKeys(value)
// (objKeys for an object, "0".."n-1" for an array) and reuses forOfLoop. The key is a
// string, so o[k] reads through. Diffed vs Node. (Object keys are simple identifiers.)
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
  const obj = () => { const ks = ["a", "b", "c", "d", "e"].filter(() => rnd() < 0.6); if (!ks.length) ks.push("a"); return `{${ks.map((k) => `${k}:${sn()}`).join(",")}}`; };
  const kw = () => (ri(2) ? "let" : "const");
  const program = () => {
    const k = ri(5);
    if (k === 0) return `let o=${obj()};let s="";for(${kw()} k in o){s=s+k};s`;                        // concat keys
    if (k === 1) return `let o=${obj()};let t=0;for(${kw()} k in o){t=t+o[k]};t`;                       // sum values
    if (k === 2) return `let o=${obj()};let ks=[];for(${kw()} k in o){ks.push(k)};ks.join(",")`;        // collect keys
    if (k === 3) { const arr = Array.from({ length: 2 + ri(4) }, () => sn()); return `let a=[${arr.join(",")}];let s="";for(${kw()} i in a){s=s+i};s`; } // array index strings
    return `let o=${obj()};let n=0;for(${kw()} k in o){n=n+1};n`;                                        // count keys
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
  if (!fails.length) console.log(`PASS jsint-forin: ${checked} for-in programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-forin: " + f); process.exit(1); }
