// fuzz/jsint/hasownprop — `o.hasOwnProperty(key)`. It was unimplemented, so the method dispatch
// recursed to a stack overflow. Fixed by a `.hasOwnProperty(` handler (added to leftmostMethod +
// dispatch) returning whether the key resolves to a defined own value (same membership test as `in`).
// Present/absent keys, variable keys, and the ubiquitous for-in + hasOwnProperty guard are covered.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 400), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const keys = ["a", "b", "c", "x", "y"];
  const program = () => {
    const k = ri(5);
    const present = keys.slice(0, 1 + ri(3));
    const obj = "{" + present.map((p) => `${p}:${ri(9)}`).join(",") + "}";
    if (k === 0) { const q = keys[ri(5)]; return `(function(){ let o=${obj}; return o.hasOwnProperty(${JSON.stringify(q)}) })()`; }
    if (k === 1) { const q = keys[ri(5)]; return `(function(){ let o=${obj}; let key=${JSON.stringify(q)}; return o.hasOwnProperty(key) })()`; }
    if (k === 2) { const q = keys[ri(5)]; return `(function(){ let o=${obj}; return o.hasOwnProperty(${JSON.stringify(q)}) ? "Y" : "N" })()`; }
    if (k === 3) return `(function(){ let o=${obj}; let c=0; for(let kk in o) if(o.hasOwnProperty(kk)) c++; return c })()`;
    return `(function(){ let o=${obj}; return o.hasOwnProperty("a") && o.hasOwnProperty("b") })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-hasownprop: ${checked} hasOwnProperty programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-hasownprop: " + f); process.exit(1); }
