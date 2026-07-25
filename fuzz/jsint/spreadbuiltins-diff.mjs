// fuzz/jsint/spreadbuiltins — spread into the rest of the variadic-builtin family that still split
// their arg text directly (not through expandSpreadArgs): Array.of, Math.hypot, and the array mutators
// .push / .unshift / .splice-inserts. Each contributed a literal NaN for a `...arr` argument (and an
// empty spread `...[]` used to push a spurious element). All now run their arg text through
// expandSpreadArgs first, so spread + plain args interleave and an empty spread adds nothing. Plain
// (non-spread) calls are regressions. Diffed vs Node (final array joined / numeric result).
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bin binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const run = (p) => { const r = spawnSync(OURS, ["__js", p], { encoding: "utf8" }); return r.status !== 0 ? `ERR:${r.status}` : (r.stdout || "").replace(/\n$/, ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 260), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const nums = (m) => Array.from({ length: m }, () => 1 + ri(20));
  const triples = [[3, 4], [6, 8], [5, 12], [8, 15], [9, 12], [20, 21], [7, 24]];
  const program = () => {
    const k = ri(8);
    if (k === 0) return `Array.of(...[${nums(2 + ri(3))}]).join(",")`;
    if (k === 1) { const t = triples[ri(triples.length)]; return `Math.hypot(...[${t[0]},${t[1]}])`; }  // exact triple → no float ULP noise
    if (k === 2) return `let a=[${nums(2)}];a.push(...[${nums(2 + ri(2))}]);a.join(",")`;
    if (k === 3) return `let a=[${nums(2)}];a.unshift(...[${nums(2)}]);a.join(",")`;
    if (k === 4) return `let a=[${nums(4)}];a.splice(${1 + ri(2)},0,...[${nums(2)}]);a.join(",")`;
    if (k === 5) return `let a=[${nums(2)}];a.push(...[],...[${nums(2)}]);a.join(",")`;    // empty + real spread
    if (k === 6) return `let a=[${nums(2)}];a.push(${1 + ri(9)},...[${nums(2)}]);a.join(",")`; // plain + spread
    return `let a=[${nums(3)}];a.push(${nums(2)});a.join(",")`;                              // regression: plain
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String((0, eval)(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-spreadbuiltins: ${checked} spread-into-variadic-builtin programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-spreadbuiltins: " + f); process.exit(1); }
