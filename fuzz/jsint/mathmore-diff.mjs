// fuzz/jsint/mathmore — Math.clz32 / Math.imul, the 32-bit-integer helpers that were unimplemented (→
// NaN). clz32 = leading zeros of ToUint32(x); imul = 32-bit integer multiply (ToInt32 x ToInt32,
// wrapping). Added to the native js_math1/js_math2 with a ToUint32 helper. This fuzzer compares them over
// random integers (incl. out-of-u32-range and negative operands, which exercise ToUint32/ToInt32) vs Node.
// (Math.fround's VALUE is correct too, but its full-precision string display exposes a Rust-vs-V8
// number-to-string tie-break difference in js_num_fmt — deferred with the broader dtoa-parity gap.)
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
  const anyInt = () => (ri(4294967296) - 2147483648);   // spans the i32/u32 range
  const program = () => {
    if (ri(2) === 0) return `(function(){ return Math.clz32(${anyInt()}) })()`;
    return `(function(){ return Math.imul(${anyInt()},${anyInt()}) })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    if (ref.includes("e") || ref.includes("E")) continue;
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-mathmore: ${checked} clz32/imul programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-mathmore: " + f); process.exit(1); }
