// fuzz/jsint/toprecision — Number.prototype.toPrecision(p): p significant digits (ECMA-262 21.1.3.5),
// switching to exponential notation when the decimal exponent is < -6 or >= p, else fixed-point. It was
// unimplemented (→ NaN). Added a native js_to_precision (mirroring js_to_fixed) that formats to p sig
// figs via Rust's correctly-rounded exponential and picks the notation, normalizing the exponent sign to
// JS form (`1.2e+5`). This fuzzer compares toPrecision over a spread of magnitudes/precisions vs Node,
// including the exponential-switch boundaries.
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
    // a value across a wide magnitude range so the exponential-switch boundaries are exercised
    const mant = (1 + ri(9999)) / (10 ** ri(4));       // e.g. 12.34, 0.0056
    const scale = 10 ** (ri(15) - 9);                   // 1e-9 .. 1e5
    const v = mant * scale * (ri(2) ? 1 : -1);
    return v;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const v = mkVal();
    const p = 1 + ri(10); // precision 1..10
    const lit = JSON.stringify(v); // exact decimal literal for the same f64
    const prog = `(function(){ return (${lit}).toPrecision(${p}) })()`;
    let ref; try { ref = String(eval(prog)); } catch { continue; }
    const got = run(prog);
    if (got !== ref) fails.push(`${prog}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-toprecision: ${checked} toPrecision programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-toprecision: " + f); process.exit(1); }
