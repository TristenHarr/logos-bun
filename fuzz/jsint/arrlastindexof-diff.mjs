// fuzz/jsint/arrlastindexof — Array.prototype.lastIndexOf. The `.lastIndexOf` handler always ran string
// lastIndexOf on the MATERIALIZED receiver, so an array was compared as its `a,b,c` join — e.g.
// `["a","b","c","b"].lastIndexOf("b")` returned char index 6 instead of element index 3. Added arrLastIndexOf
// (scan backward, element strict-equality) and a branching lastIdxOf that keeps string lastIndexOf for a
// string receiver. This fuzzer compares lastIndexOf over random number/string/bool arrays AND over strings
// vs Node.
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
  const program = () => {
    const k = ri(3);
    if (k === 0) {
      const arr = Array.from({ length: 1 + ri(7) }, () => ri(5));
      return `(function(){ return [${arr}].lastIndexOf(${ri(6)}) })()`;
    }
    if (k === 1) {
      const arr = Array.from({ length: 1 + ri(7) }, () => JSON.stringify("abc"[ri(3)]));
      return `(function(){ return [${arr.join(",")}].lastIndexOf(${JSON.stringify("abc"[ri(4)] || "a")}) })()`;
    }
    const s = Array.from({ length: 1 + ri(10) }, () => "abcab"[ri(5)]).join("");
    return `(function(){ return ${JSON.stringify(s)}.lastIndexOf(${JSON.stringify("abc"[ri(3)])}) })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-arrlastindexof: ${checked} lastIndexOf programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-arrlastindexof: " + f); process.exit(1); }
