// fuzz/jsint/isfinite — Number.isFinite (unlike global isFinite) does NOT coerce: it is true iff the
// argument is already a Number value AND finite. It was implemented with isIntStr, so every DECIMAL
// (0.5, 3.14, 1/3, Math.random()) wrongly returned false. jsIsFiniteNumber now requires a numeric
// value (integer or decimal) that is neither NaN nor ±Infinity; strings/booleans/null are false (no
// coercion), matching the global isFinite only where the value is already a number. Diffed vs Node.
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
  const val = () => {
    const k = ri(10);
    if (k === 0) return `${ri(1000)}`;
    if (k === 1) return `${ri(1000)}.${ri(1000)}`;
    if (k === 2) return `-${ri(100)}.${ri(100)}`;
    if (k === 3) return `${1 + ri(9)}/${1 + ri(9)}`;
    if (k === 4) return `"${ri(100)}"`;
    if (k === 5) return `NaN`;
    if (k === 6) return `Infinity`;
    if (k === 7) return `true`;
    if (k === 8) return `null`;
    return `${ri(50)}e${ri(3)}`;
  };
  const program = () => {
    const v = val(), k = ri(3);
    if (k === 0) return `Number.isFinite(${v})`;
    if (k === 1) return `Number.isFinite(${v})?"y":"n"`;
    return `[${v}].map(x=>Number.isFinite(x)).join(",")`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-isfinite: ${checked} Number.isFinite programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-isfinite: " + f); process.exit(1); }
