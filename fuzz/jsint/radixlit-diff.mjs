// fuzz/jsint/radixlit — radix number LITERALS in source (0xFF / 0b101 / 0o17). The engine only
// recognized decimal literals, so a bare 0xFF evaluated to NaN and `0xFF|0x100` fed NaN to the
// bitwise ops (which panicked). Literals now convert to their decimal value at the value/arith
// boundary, so they work bare, in arithmetic, in comparisons, and as bitwise operands. Random
// programs diffed vs Node.
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
  const hd = "0123456789abcdef";
  const hex = () => "0x" + Array.from({ length: 1 + ri(4) }, () => hd[ri(16)]).join("");
  const bin = () => "0b" + Array.from({ length: 1 + ri(6) }, () => "01"[ri(2)]).join("");
  const oct = () => "0o" + Array.from({ length: 1 + ri(4) }, () => "01234567"[ri(8)]).join("");
  const lit = () => [hex, bin, oct][ri(3)]();
  const program = () => {
    const k = ri(7);
    if (k === 0) return `${lit()}`;                 // bare literal
    if (k === 1) return `${hex()}+${ri(50)}`;       // arithmetic
    if (k === 2) return `${hex()}|${hex()}`;        // bitwise OR (was the crash)
    if (k === 3) return `${hex()}&${hex()}`;        // bitwise AND
    if (k === 4) return `${hex()}===${ri(20)}`;     // comparison
    if (k === 5) return `${hex()}*2`;               // multiply
    return `${bin()}+${oct()}`;                     // mixed radix arithmetic
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-radixlit: ${checked} radix-literal programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-radixlit: " + f); process.exit(1); }
