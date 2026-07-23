// fuzz/jsint/arithedge — arithmetic edge cases that used to PANIC the runtime: integer `%` by zero
// (→ NaN), integer `**` with a negative/zero exponent (→ a float, e.g. 2**-1===0.5), and bitwise
// `~` on a non-integer (ToInt32 truncates first, so ~3.7===-4). JS `**` and `%` always produce a
// Number, so both route to the IEEE-754 f64 evaluator (like `/` already does); `~`/`~~` truncate to
// Int32. Random expressions diffed vs Node.
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
  const nz = () => 1 + ri(12);
  const anyn = () => ri(13);
  const flt = () => (1 + ri(90) / 10).toFixed(1);
  const program = () => {
    const k = ri(9);
    if (k === 0) return `${anyn()}%${ri(6)}`;           // includes %0 -> NaN
    if (k === 1) return `${nz()}%${nz()}`;              // ordinary modulo
    if (k === 2) return `2**${-1 - ri(4)}`;             // negative exponent -> float
    if (k === 3) return `${1 + ri(5)}**${ri(6)}`;       // int power (incl **0)
    if (k === 4) return `~${flt()}`;                    // ~ non-integer -> ToInt32 trunc
    if (k === 5) return `~~${flt()}`;                   // double NOT trunc
    if (k === 6) return `~${anyn()}`;                   // ~ integer still works
    if (k === 7) return `${nz()}%${nz()}+${nz()}`;      // modulo in a bigger expr
    return `${1 + ri(4)}**2%${nz()}`;                   // ** and % combined
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-arithedge: ${checked} arithmetic-edge exprs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-arithedge: " + f); process.exit(1); }
