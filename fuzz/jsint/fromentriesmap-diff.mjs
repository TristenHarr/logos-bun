// fuzz/jsint/fromentriesmap — Object.fromEntries accepts a Map (not only an array of pairs).
// objFromEntries called arrElements directly, so a Map source produced {} ; it now converts a Map via
// mapEntriesArr first (isMap-gated), leaving the array-of-pairs path unchanged. Diffed vs Node.
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
  const keys = ["a", "b", "c", "x", "y", "k1", "k2"];
  const entries = () => { const m = 1 + ri(4), used = new Set(), ps = []; for (let j = 0; j < m; j++) { let k; do { k = keys[ri(keys.length)]; } while (used.has(k)); used.add(k); ps.push(`["${k}",${ri(100)}]`); } return ps.join(","); };
  const program = () => {
    const es = entries(), k = ri(5);
    if (k === 0) return `JSON.stringify(Object.fromEntries(new Map([${es}])))`;
    if (k === 1) return `JSON.stringify(Object.fromEntries([${es}]))`;                     // regression: array
    if (k === 2) return `Object.keys(Object.fromEntries(new Map([${es}]))).length`;
    if (k === 3) return `(()=>{const m=new Map([${es}]);return JSON.stringify(Object.fromEntries(m))})()`;
    return `Object.values(Object.fromEntries(new Map([${es}]))).reduce((a,b)=>a+b,0)`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-fromentriesmap: ${checked} Object.fromEntries(Map) programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-fromentriesmap: " + f); process.exit(1); }
