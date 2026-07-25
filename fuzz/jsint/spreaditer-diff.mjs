// fuzz/jsint/spreaditer — spreading a non-array ITERABLE into CALL arguments (Math.max(...set),
// f(...str), Math.min(...map.values())). The call-arg spread expanded via arrElements, which only
// knows arrays, so a Set/Map/string spread produced NaN; it now uses iterElements (the same iterable
// handler the [...x] array spread uses), so Set/Map/string/array all expand uniformly. Array spread and
// multiple spreads are regressions. Diffed vs Node.
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
  const nums = () => Array.from({ length: 2 + ri(4) }, () => 1 + ri(50));
  const program = () => {
    const a = nums(), k = ri(7);
    if (k === 0) return `Math.max(...new Set([${a}]))`;
    if (k === 1) return `Math.min(...new Set([${a}]))`;
    if (k === 2) return `Math.max(...new Map([${a.map((x, i) => `["k${i}",${x}]`)}]).values())`;
    if (k === 3) return `((...xs)=>xs.length)(...new Set([${a}]))`;
    if (k === 4) return `Math.max(..."${a.map(x => x % 10).join("")}")`;   // string spread of digits
    if (k === 5) return `Math.max(...[${a}])`;                             // regression: array spread
    return `Math.min(...[${a.slice(0, 2)}],...[${a.slice(2)}])`;          // regression: multiple spreads
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-spreaditer: ${checked} iterable-spread programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-spreaditer: " + f); process.exit(1); }
