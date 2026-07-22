// fuzz/jsint/date-diff — the Date object's DETERMINISTIC UTC surface: `new Date(ms)` over a wide
// millisecond range (pre-epoch negatives through year ~2200), then getTime/valueOf and the whole
// getUTC* family (FullYear/Month/Date/Day/Hours/Minutes/Seconds/Milliseconds) plus toISOString /
// toJSON — all backed by a manual epoch→civil-date conversion in the toolchain (no chrono), so leap
// years, century non-leaps (2100) and negative timestamps all land bit-exact. `Date.now()` is
// non-deterministic (wall clock) so it is NOT diffed here — only typeof/relational, which are stable.
// Whole programs run through `bun run` and diffed vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const NODE = process.execPath;
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dir = mkdtempSync(join(tmpdir(), "date-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const UTC = ["getTime", "valueOf", "getUTCFullYear", "getUTCMonth", "getUTCDate", "getUTCDay", "getUTCHours", "getUTCMinutes", "getUTCSeconds", "getUTCMilliseconds", "toISOString", "toJSON"];
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  // A millisecond stamp spanning ~1938 → ~2200, including negatives and epoch/boundary hits.
  const stamp = () => {
    const k = ri(5);
    if (k === 0) return 0;
    if (k === 1) return -(1 + ri(2000000000000));               // pre-epoch
    if (k === 2) return 1 + ri(999);                             // sub-second
    if (k === 3) return ri(7258118400000);                      // 1970..2200
    return ri(2000000000000) - 1000000000000;                    // straddle epoch
  };
  const program = () => {
    const ms = stamp();
    const k = ri(4);
    if (k === 0) { const m = UTC[ri(UTC.length)]; return `console.log(new Date(${ms}).${m}());`; }
    if (k === 1) return `let d=new Date(${ms});console.log(d.getUTCFullYear()+"-"+d.getUTCMonth()+"-"+d.getUTCDate());`;
    if (k === 2) return `let d=new Date(${ms});console.log(d.getUTCHours()+":"+d.getUTCMinutes()+":"+d.getUTCSeconds()+"."+d.getUTCMilliseconds());`;
    return `console.log(new Date(${ms}).toISOString()+" day="+new Date(${ms}).getUTCDay());`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src);
    const got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  // Date.now() is wall-clock — only its stable shape is checked.
  for (const src of [`console.log(typeof Date.now());`, `console.log(Date.now()>0);`, `console.log(typeof new Date(0));`]) {
    const ref = runNode(src), got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-date: ${checked} Date programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-date: " + f); process.exit(1); }
