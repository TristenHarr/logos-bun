// fuzz/jsint/mathcallback — a Math.* call inside a function/arrow body (map/reduce/filter callback).
// Was resolved at closure-creation time with the callback param unbound -> NaN baked in. The Math
// dispatches now skip a marker that sits inside a function body (markerInBody), so it resolves at call
// time with the param bound. Direct Math calls are the regression guard.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const arr = () => "[" + Array.from({ length: 1 + ri(4) }, () => 1 + ri(9)).join(",") + "]";
  const unary = () => ["Math.floor", "Math.ceil", "Math.round", "Math.abs", "Math.sqrt", "Math.trunc", "Math.sign"][ri(7)];
  const program = () => {
    const k = ri(4);
    if (k === 0) return `${arr()}.map(x=>${unary()}(x)).join(",")`;
    if (k === 1) return `${arr()}.map(x=>Math.max(x,${1 + ri(9)})).join(",")`;
    if (k === 2) return `${arr()}.reduce((a,b)=>Math.max(a,b))`;
    return `${arr()}.reduce((a,b)=>Math.min(a,b),99)`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-mathcallback: ${checked} Math-in-callback programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-mathcallback: " + f); process.exit(1); }
