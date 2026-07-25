// fuzz/jsint/numformat — JS Number.toString(10) across magnitudes. Large integers (> 15 digits) and
// e-notation literals now route to the native f64 path (floatTok), fixing a crash on 21-digit literals
// and giving JS-correct rounding (9999999999999999 → 10000000000000000). jsNumFormat then rescales the
// raw decimal to JS exponential form when magnitude >= 1e21 or < 1e-6 (1e21 → "1e+21", 1e-7 → "1e-7",
// 1.5e300 → "1.5e+300"), leaving mid-range numbers as plain decimals. Diffed vs Node. All programs are
// wrapped in String(...) so nothing starts with a leading minus (which the node -e harness would treat
// as a CLI flag).
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 260), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const m = 1 + ri(9), e = ri(24), frac = ri(9), k = ri(8);
    if (k === 0) return `String(${m}e${e})`;
    if (k === 1) return `String(${m}.${frac}e${e})`;
    if (k === 2) return `String(${m}e-${1 + ri(12)})`;
    if (k === 3) return `String(${m}e${e}+1)`;
    if (k === 4) return `String(${m}${"0".repeat(ri(24))})`;                  // big integer literal
    if (k === 5) return `String(1e${e}/1e${ri(e + 1)})`;                      // division across magnitudes
    if (k === 6) return `String(${m}.${frac})`;                               // mid-range decimal regression
    return `String(${m}e${1 + ri(6)})`;                                       // mid-range exponent regression
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String((0, eval)(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-numformat: ${checked} number-format programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-numformat: " + f); process.exit(1); }
