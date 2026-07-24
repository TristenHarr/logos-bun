// fuzz/jsint/protocall — borrowing a prototype method via `Type.prototype.method.call/.apply`. This
// STACK-OVERFLOWED the engine (`Array.prototype.slice.call([1,2,3])` aborted): `.prototype.` was never
// resolved as a value, so the .call/.apply receiver evaluation recursed without bound. It is now rewritten
// to a direct method call on the borrowed receiver — `Type.prototype.M.call(thisArg, ...args)` becomes
// `thisArg.M(...args)`, `.apply(thisArg, arr)` becomes `thisArg.M(...arr)` — and ordinary method dispatch
// handles it (the rewrite's internal spacing is collapsed so no empty token desyncs the chain resolver).
// The classic `Array.prototype.slice.call(arguments)` idiom works. Exercises slice/map/filter/concat/indexOf/
// join borrowed onto arrays + arguments, and String.prototype methods borrowed onto strings; plain method
// calls are re-checked as regressions. Diffed vs Node.
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
    const a = ri(9), b = ri(9), c = ri(9), s = ri(5), k = ri(11);
    if (k === 0) return `Array.prototype.slice.call([${a},${b},${c}],1).join(",")`;
    if (k === 1) return `Array.prototype.slice.call([${a},${b},${c}]).join("-")`;
    if (k === 2) return `Array.prototype.map.call([${a},${b},${c}],x=>x*2).join(",")`;
    if (k === 3) return `Array.prototype.filter.call([${a},${b},${c},${a + 1}],x=>x%2===0).length`;
    if (k === 4) return `Array.prototype.concat.call([${a}],[${b},${c}]).join(",")`;
    if (k === 5) return `Array.prototype.indexOf.call([${a},${b},${c}],${b})`;
    if (k === 6) return `(function(){return Array.prototype.slice.call(arguments,1).join(",")})(${a},${b},${c})`;
    if (k === 7) return `(function(){return Array.prototype.slice.call(arguments).length})(${a},${b},${c})`;
    if (k === 8) return `String.prototype.toUpperCase.call("ab${s}")`;
    if (k === 9) return `[${a},${b},${c}].map(x=>x+1).join(",")`;          // regression: plain method
    return `"hi${s}".toUpperCase()`;                                       // regression: plain string method
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-protocall: ${checked} prototype-method-borrow programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-protocall: " + f); process.exit(1); }
