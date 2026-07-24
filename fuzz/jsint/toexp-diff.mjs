// fuzz/jsint/toexp — Number.prototype.toExponential(fractionDigits): exponential notation with exactly
// fractionDigits digits after the point (n+1 significant digits), the exact f64 rounded HALF-UP, exponent
// in JS form (e+0). Was unimplemented (→ NaN). Added a native js_to_exponential reusing the exact-value
// half-up rounding (js_round_sig) + JS exponent-sign normalization. Because the digit count is FIXED it is
// dtoa-safe (unlike the shortest-form which hits the Rust-vs-V8 number-to-string gap). This fuzzer compares
// toExponential(n) over a wide magnitude range (within the engine's representable range) vs Node; the
// no-argument shortest form and magnitudes >= ~1e18 (the deferred large-number gap) are not fuzzed.
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
    const mant = (1 + ri(999999)) / (10 ** ri(6));
    const scale = 10 ** ri(12);                       // up to 1e11 — well within the representable range
    return mant * scale * (ri(2) ? 1 : -1);
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const v = mkVal();
    if (!Number.isFinite(v) || Math.abs(v) >= 1e17) continue; // stay in the engine's representable range
    const d = ri(9); // 0..8 fraction digits
    const prog = `(function(){ return (${JSON.stringify(v)}).toExponential(${d}) })()`;
    let ref; try { ref = String(eval(prog)); } catch { continue; }
    const got = run(prog);
    if (got !== ref) fails.push(`${prog}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-toexp: ${checked} toExponential programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-toexp: " + f); process.exit(1); }
