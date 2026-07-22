// fuzz/jsint/division-diff — integer division (`/`). The engine is integer-based, so `/` performs
// integer division — correct for EXACT divisions (a divisible by b), which this fuzzer restricts
// to (a = b*k). `/` is now a spaced operator (isOp1) and computed in jsEvalAdd alongside * and %.
// Covers a/b, chained a/b/c, and division mixed with +/-/* under precedence, diffed vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ours = (e) => { const r = spawnSync(OURS, ["__js", e], { encoding: "utf8" }); return r.status !== 0 ? `ERR:${r.status}` : (r.stdout || "").replace(/\n$/, ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 2000), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const b = () => 1 + ri(9);          // divisor 1..9
  const k = () => 1 + ri(9);          // quotient 1..9
  const expr = () => {
    const t = ri(5), d1 = b(), q1 = k(), d2 = b(), q2 = k();
    if (t === 0) return `${d1 * q1}/${d1}`;                         // exact a/b = q1
    if (t === 1) return `${d1 * q1 * d2}/${d1}/${d2}`;              // chained /
    if (t === 2) return `${d1 * q1}/${d1}+${q2}`;                    // div then add
    if (t === 3) return `${q1}*${d2 * q2}/${d2}`;                    // mul then div
    return `${d1 * q1}/${d1}-${1 + ri(3)}`;                          // div then sub
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const e = expr();
    let ref; try { ref = String(eval(e)); } catch { continue; }
    const got = ours(e);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(e)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-division: ${checked} exact-division expressions agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-division: " + f); process.exit(1); }
