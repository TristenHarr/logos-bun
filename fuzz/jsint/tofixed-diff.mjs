// fuzz/jsint/tofixed — Number.prototype.toFixed(digits). The native js_to_fixed rounded via Rust's
// `format!`, which is round-half-to-EVEN, so it disagreed with JS on exact-f64 ties: `(2.5).toFixed(0)`
// was "2" not "3", `(12.5).toFixed(0)` was "12" not "13". Rewrote it to round the EXACT f64 value HALF-UP
// via string digits (like toPrecision) — including the subtle `(1.005).toFixed(2)` → "1.00" (the exact
// f64 is 1.00499999…) and `(52915236.0975).toFixed(3)` → ".097". This fuzzer compares toFixed over random
// magnitudes/precisions vs Node, and deliberately samples the half-integer tie boundary.
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
  const mkVal = () => {
    if (ri(3) === 0) {
      // half-integer / half-at-the-cut ties: k + 0.5 at some scale
      const k = ri(100000);
      const scale = 10 ** ri(4);
      return (k + 0.5) / scale * (ri(2) ? 1 : -1);
    }
    const mant = ri(1000000) / (10 ** ri(6));
    const scale = 10 ** ri(6);
    return mant * scale * (ri(2) ? 1 : -1);
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const v = mkVal();
    if (!Number.isFinite(v)) continue;
    const d = ri(8); // 0..7 fractional digits
    const lit = JSON.stringify(v);
    const prog = `(function(){ return (${lit}).toFixed(${d}) })()`;
    let ref; try { ref = String(eval(prog)); } catch { continue; }
    if (ref.includes("e") || ref.includes("E")) continue; // scientific (huge) → deferred number-display gap
    const got = run(prog);
    if (got !== ref) fails.push(`${prog}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-tofixed: ${checked} toFixed programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-tofixed: " + f); process.exit(1); }
