// fuzz/jsint/mathapply — a native Math function borrowed via `.apply`/`.call`. `Math.max.apply(null, arr)`
// (the classic pre-spread "max of an array" idiom) and `Math.max.call(null, a, b)` returned NaN — the
// receiver `Math.max` is not a heap function value, so the generic .apply/.call handler bailed. The handlers
// now, when the receiver is a `Math.` member, rewrite the borrow to a direct call: `.apply` spreads the
// array argument, `.call` drops the thisArg and forwards the rest, then ordinary `Math.<fn>(...)` dispatch
// runs. Exercises max/min/pow via apply (literal array and a variable) and call; plain `Math.<fn>(...)` and
// array .map are re-checked as regressions. Diffed vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 200), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = ri(40), b = ri(40), c = ri(40), k = ri(9);
    if (k === 0) return `Math.max.apply(null,[${a},${b},${c}])`;
    if (k === 1) return `Math.min.apply(null,[${a},${b},${c}])`;
    if (k === 2) return `Math.max.call(null,${a},${b},${c})`;
    if (k === 3) return `Math.min.call(null,${a},${b},${c})`;
    if (k === 4) return `(function(){const arr=[${a},${b},${c}];return Math.max.apply(null,arr)})()`;
    if (k === 5) return `Math.max.apply(Math,[${a},${b}])+${c}`;
    if (k === 6) return `Math.pow.apply(null,[${1 + (a % 5)},${b % 4}])`;
    if (k === 7) return `Math.max(${a},${b},${c})`;                  // regression: plain Math.max
    return `[${a},${b},${c}].map(x=>x+1).join(",")`;                 // regression: plain method
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-mathapply: ${checked} Math-borrow programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-mathapply: " + f); process.exit(1); }
