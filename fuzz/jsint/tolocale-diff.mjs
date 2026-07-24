// fuzz/jsint/tolocale — Number.prototype.toLocaleString() default (en-US) formatting: comma thousands
// separators, up to 3 fractional digits rounded HALF-UP, trailing zeros stripped. It was unimplemented
// (→ NaN). Added a native js_to_locale_num (toolchain) reusing the exact-value half-up rounding from
// toPrecision. This fuzzer compares number toLocaleString() over a wide magnitude range vs Node (the box
// is en-US, verified). Non-number receivers (arrays with large numbers) are a documented approximation
// and not fuzzed here.
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
    const intPart = ri(10 ** (1 + ri(9)));                 // up to ~10 digits
    const frac = ri(4) === 0 ? 0 : (1 + ri(9999)) / (10 ** (1 + ri(5)));
    const v = (intPart + frac) * (ri(2) ? 1 : -1);
    return v;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const v = mkVal();
    const lit = JSON.stringify(v); // exact f64 literal
    const prog = `(function(){ return (${lit}).toLocaleString() })()`;
    let ref; try { ref = String(eval(prog)); } catch { continue; }
    // skip if Node produced scientific display (magnitudes our number model can't print) — deferred gap
    if (ref.includes("e") || ref.includes("E")) continue;
    const got = run(prog);
    if (got !== ref) fails.push(`${prog}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-tolocale: ${checked} toLocaleString programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-tolocale: " + f); process.exit(1); }
