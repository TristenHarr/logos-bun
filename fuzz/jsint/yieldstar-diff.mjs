// fuzz/jsint/yieldstar — `yield*` delegation inside a generator: it yields every value of the operand
// (an array's elements, a called generator's values, a string's chars). `yield* xs` was mis-read as
// `yield (*xs)` → a single NaN. Fixed by a `yield*` branch that genPushes each element of iterElements.
// Plain `yield` and generator iteration are the regression guards.
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
  const nums = () => Array.from({ length: 1 + ri(3) }, () => ri(9));
  const program = () => {
    const k = ri(6);
    if (k === 0) return `(function(){ function* g(){ yield* [${nums().join(",")}]; yield ${ri(9)} } return [...g()].join(",") })()`;
    if (k === 1) return `(function(){ function* g(){ yield ${ri(9)}; yield* [${nums().join(",")}] } return [...g()].join(",") })()`;
    if (k === 2) return `(function(){ function* g(){ yield* [${nums().join(",")}]; yield* [${nums().join(",")}] } return [...g()].join(",") })()`;
    if (k === 3) return `(function(){ function* inner(){ yield ${ri(9)}; yield ${ri(9)} } function* g(){ yield* inner(); yield ${ri(9)} } return [...g()].join(",") })()`;
    if (k === 4) return `(function(){ function* g(){ yield ${ri(9)}; yield ${ri(9)}; yield ${ri(9)} } return [...g()].join(",") })()`;   // plain yield (guard)
    return `(function(){ function* r(m){ for(let i=0;i<m;i++) yield i*i } return [...r(${1 + ri(4)})].join(",") })()`;                     // generator loop (guard)
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-yieldstar: ${checked} yield* programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-yieldstar: " + f); process.exit(1); }
