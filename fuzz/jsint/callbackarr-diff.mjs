// fuzz/jsint/callbackarr — the third callback argument (the array itself) in map / filter / forEach:
// `arr.map((value, index, array) => …)`. The loops only threaded (value, index) to callFnIdx, so a
// callback that referenced its third parameter saw `undefined` (→ `a.length` = NaN, `a[i]` = undefined).
// Added callFnIdx3 binding the iterated array as the third arg when declared, threaded through the map /
// filter / forEach loops. This fuzzer builds callbacks that read `a.length` / `a[i]` and compares vs Node.
// forEach accumulates through a heap array (push) — scalar `s+=` closure-writeback is a separate gap.
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
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 300), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const mkArr = () => `[${Array.from({ length: 1 + ri(6) }, () => ri(50)).join(",")}]`;
  const program = () => {
    const arr = mkArr();
    const k = ri(4);
    // each callback exercises the third (array) parameter
    if (k === 0) return `(function(){ return ${arr}.map((v,i,a)=>a.length).join("-") })()`;
    if (k === 1) return `(function(){ return ${arr}.map((v,i,a)=>v+a[i]).join(",") })()`;
    if (k === 2) return `(function(){ return ${arr}.filter((v,i,a)=>i<a.length-1).join(",") })()`;
    return `(function(){ let out=[]; ${arr}.forEach((v,i,a)=>out.push(a.length-i)); return out.join(",") })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-callbackarr: ${checked} array-callback-arg programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-callbackarr: " + f); process.exit(1); }
