// fuzz/jsint/datelocal — Date.prototype.getHours / getMinutes / getSeconds. The UTC variants were wired
// but the local ones were absent from both the method table and dateMethod, so they returned NaN. The
// engine is UTC-only (getFullYear == getUTCFullYear), so each local getter aliases its UTC field. This
// fuzzer builds component dates and single-timestamp dates and compares the local time getters vs Node
// (TZ forced to UTC so a component date's local == UTC, matching the engine).
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
const nodeEval = (p) => { try { return String(eval(p)); } catch { return null; } };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 300), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const getters = ["getHours", "getMinutes", "getSeconds"];
  const program = () => {
    const g = getters[ri(getters.length)];
    if (ri(2)) {
      const y = 1971 + ri(80), mo = ri(12), d = 1 + ri(28), h = ri(24), mi = ri(60), se = ri(60);
      return `(function(){ return new Date(${y},${mo},${d},${h},${mi},${se}).${g}() })()`;
    }
    const ts = Math.floor(rnd() * 1e12);
    return `(function(){ return new Date(${ts}).${g}() })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    const ref = nodeEval(p); if (ref === null) continue;
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-datelocal: ${checked} local date-getter programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-datelocal: " + f); process.exit(1); }
