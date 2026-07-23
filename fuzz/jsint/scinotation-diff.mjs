// fuzz/jsint/scinotation — scientific-notation numbers. `floatTok` only recognized a decimal POINT, so an
// integer-mantissa exponent (`1e3`, `2e-2`) was NaN in every position (literal, Number(), unary plus,
// arithmetic, toString) while `2.5e3` (decimal mantissa) worked. Now `sciTok` recognizes strict
// scientific form and coercion canonicalizes it to decimal via native jsParseFloat (a magnitude guard,
// sciSafe, keeps a literal that overflows i64 from crashing the Int parse — it falls back to NaN, since
// JS's scientific DISPLAY for >= ~1e18 is a separate deferred feature). The tokenizer also now keeps a
// signed exponent (`1e-2`/`1e+2`) together instead of splitting at the `-`/`+`. This fuzzer builds
// scientific numbers whose VALUE Node renders as a plain decimal (skipping the >=1e21 / <=1e-7 cases Node
// itself prints in scientific, which are the deferred large/small-display gap) and compares literal,
// Number(string), and arithmetic forms.
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
  // a scientific literal string whose numeric value Node prints as a plain decimal (no 'e')
  const mkNum = () => {
    for (let tries = 0; tries < 40; tries++) {
      const mant = ri(3) === 0 ? String(1 + ri(99)) : (1 + ri(99)) + "." + (1 + ri(9)); // int or 1-decimal
      const e = ri(2) ? "e" : "E";
      const sign = ri(3) === 0 ? "" : (ri(2) ? "-" : "+");
      const exp = 1 + ri(12);
      const lit = `${mant}${e}${sign}${exp}`;
      const val = Number(lit);
      if (Number.isFinite(val) && !String(val).includes("e")) return lit;
    }
    return "1e3";
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const lit = mkNum();
    const k = ri(4);
    const prog = k === 0 ? `(function(){ return ${lit} })()`
      : k === 1 ? `(function(){ return Number(${JSON.stringify(lit)}) })()`
      : k === 2 ? `(function(){ return ${lit} + 1 })()`
      : `(function(){ return (${lit}).toString() })()`;
    let ref; try { ref = String(eval(prog)); } catch { continue; }
    if (ref.includes("e") || ref.includes("E")) continue; // Node used scientific display → deferred gap
    const got = run(prog);
    if (got !== ref) fails.push(`${prog}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-scinotation: ${checked} scientific-notation programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-scinotation: " + f); process.exit(1); }
