// fuzz/jsint/datetimez — new Date("YYYY-MM-DDTHH:MM:SS(.sss)Z"): a UTC (Z-suffixed) ISO datetime is
// parsed to epoch-ms via parseDateStr/parseTimeMs (fractional seconds -> milliseconds, 3-digit
// padded). getTime and the getUTC* accessors read it back. Only the Z (UTC) form is exercised — a
// datetime with no offset is local time, which the engine (UTC-only) leaves NaN by design. Diffed vs
// Node (the harness runs eval() on the same box; Z is timezone-independent so both agree everywhere).
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const p2 = (x) => String(x).padStart(2, "0");
  const dt = (withMs) => {
    const base = `${1971 + ri(60)}-${p2(1 + ri(12))}-${p2(1 + ri(28))}T${p2(ri(24))}:${p2(ri(60))}:${p2(ri(60))}`;
    return withMs ? `${base}.${String(ri(1000)).padStart(3, "0")}Z` : `${base}Z`;
  };
  const program = () => {
    const s = dt(ri(2) === 0), k = ri(6);
    if (k === 0) return `new Date("${s}").getTime()`;
    if (k === 1) return `new Date("${s}").getUTCHours()`;
    if (k === 2) return `new Date("${s}").getUTCMinutes()`;
    if (k === 3) return `new Date("${s}").getUTCSeconds()`;
    if (k === 4) return `new Date("${s}").getUTCFullYear()`;
    return `new Date("${s}").getUTCMilliseconds()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-datetimez: ${checked} UTC datetime programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-datetimez: " + f); process.exit(1); }
