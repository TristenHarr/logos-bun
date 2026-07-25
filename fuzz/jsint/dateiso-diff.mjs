// fuzz/jsint/dateiso — new Date("YYYY-MM-DD") parses an ISO date-only string to epoch-ms (UTC
// midnight) via parseDateStr + daysFromCivil; the single-arg Date constructor treated any arg as ms,
// so a string produced NaN. getUTCFullYear/Month/Date and getTime read back the parsed value. Numeric
// (Y,M,D) and millisecond single-arg constructors are regressions, and a non-date string stays NaN.
// Datetime strings ("…T…") are intentionally NaN (local/UTC rule is a follow-up). Diffed vs Node.
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
  const pad2 = (x) => String(x).padStart(2, "0");
  const iso = () => `${1971 + ri(60)}-${pad2(1 + ri(12))}-${pad2(1 + ri(28))}`;
  const program = () => {
    const s = iso(), k = ri(7);
    if (k === 0) return `new Date("${s}").getUTCFullYear()`;
    if (k === 1) return `new Date("${s}").getUTCMonth()`;
    if (k === 2) return `new Date("${s}").getUTCDate()`;
    if (k === 3) return `new Date("${s}").getTime()`;
    if (k === 4) return `new Date(${1970 + ri(60)},${ri(12)},${1 + ri(27)}).getMonth()`;   // regression: numeric
    if (k === 5) return `new Date(${ri(2000000000)}).getUTCFullYear()`;                     // regression: ms
    return `new Date("not a date").getTime()`;                                              // regression: invalid
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-dateiso: ${checked} Date-ISO programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-dateiso: " + f); process.exit(1); }
