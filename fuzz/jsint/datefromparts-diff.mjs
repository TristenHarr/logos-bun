// fuzz/jsint/datefromparts — the multi-argument Date constructor `new Date(year, monthIndex, day,
// hours, minutes, seconds, ms)`. Only the single-timestamp form worked; the component form returned
// NaN (the comma-list wasn't parsed into an epoch). Fixed by dateFromParts + daysFromCivil (Hinnant's
// exact civil→epoch). The engine is UTC-only (getFullYear == getUTCFullYear), so a component-built date
// is a UTC epoch; we compare the timezone-independent getUTC* getters (and getTime under a UTC test
// environment, which CI and this box use — TZ forced to UTC for the Node oracle for robustness).
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
process.env.TZ = "UTC";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const run = (p) => { const r = spawnSync(OURS, ["__js", p], { encoding: "utf8" }); return r.status !== 0 ? `ERR:${r.status}` : (r.stdout || "").replace(/\n$/, ""); };
// oracle: run in a UTC child so `new Date(y,m,d)` (local) equals our UTC epoch
const nodeUtc = (p) => { try { return String(eval(p)); } catch { return null; } };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 300), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const y = () => 1971 + ri(80), mo = () => ri(12), d = () => 1 + ri(28);
  const program = () => {
    const k = ri(6);
    if (k === 0) return `(function(){ return new Date(${y()},${mo()},${d()}).getUTCFullYear() })()`;
    if (k === 1) return `(function(){ return new Date(${y()},${mo()},${d()}).getUTCMonth() })()`;
    if (k === 2) return `(function(){ return new Date(${y()},${mo()},${d()}).getUTCDate() })()`;
    if (k === 3) return `(function(){ return new Date(${y()},${mo()},${d()},${ri(24)},${ri(60)},${ri(60)}).getTime() })()`;
    if (k === 4) return `(function(){ let d=new Date(${y()},${mo()},${d()},${ri(24)}); return d.getUTCHours()+"/"+d.getUTCFullYear() })()`;
    return `(function(){ return new Date(${y()},${mo()},${d()}).getUTCDay() })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    const ref = nodeUtc(p); if (ref === null) continue;
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-datefromparts: ${checked} Date(y,m,d,…) programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-datefromparts: " + f); process.exit(1); }
