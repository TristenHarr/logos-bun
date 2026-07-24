// fuzz/jsint/numinfinity — Number(str)/string-coercion of the literal "Infinity" (and "+Infinity"/
// "-Infinity") yields ±Infinity, case-sensitively ("infinity"/"Infinityx" stay NaN). The coerced value
// is consistent with 1/0 (===) and orders above every finite number. Finite numeric strings and
// non-numeric strings are regressions. (Infinity ARITHMETIC and the 1e308-overflow comparison are
// pre-existing gaps, not exercised here.) Diffed vs Node.
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
  const inf = () => ['"Infinity"', '"-Infinity"', '"+Infinity"'][ri(3)];
  const bad = () => ['"infinity"', '"Infinityx"', '"xInfinity"', '"Inf"'][ri(4)];
  const program = () => {
    const k = ri(7);
    if (k === 0) return `Number(${inf()})`;
    if (k === 1) return `String(Number(${inf()}))`;
    if (k === 2) return `Number(${inf()})===1/0?"eq":Number(${inf()})===-1/0?"neg":"other"`;
    if (k === 3) return `Number(${inf()})>${ri(1000000)}?"t":"f"`;
    if (k === 4) return `Number(${bad()})`;                        // regression: not Infinity -> NaN
    if (k === 5) return `Number("${ri(10000)}")`;                  // regression: finite
    return `Number("${ri(100)}.${ri(100)}")`;                      // regression: finite float
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-numinfinity: ${checked} Number(Infinity) programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-numinfinity: " + f); process.exit(1); }
