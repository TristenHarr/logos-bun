// fuzz/jsint/math-diff — the P7 JS engine's Math.max / Math.min / Math.abs,
// differential-fuzzed vs Node eval. Matched by the literal `Math . fn (` pattern in
// resolveMethods (the "Math" is part of the match, so no receiver value is needed),
// evaluated over the integer engine. Covers bare calls, results in arithmetic,
// variable + expression arguments, and nested Math calls.
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
const nodeRun = (p) => { const parts = p.split(";"); const body = parts.slice(0, -1).map((s) => s + ";").join("") + " return (" + parts[parts.length - 1] + ");"; return eval("(()=>{" + body + "})()"); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 600), rnd = mul(seed);
  const sn = () => Math.floor(rnd() * 40) - 20;    // -20..19
  const program = () => {
    const k = rnd();
    if (k < 0.22) return `Math.max(${sn()},${sn()})`;
    if (k < 0.44) return `Math.min(${sn()},${sn()})`;
    if (k < 0.6) return `Math.abs(${sn()})`;
    if (k < 0.62) return `Math.max(${sn()},${sn()})+${Math.floor(rnd() * 10)}`;          // into arithmetic
    if (k < 0.7) { const a = sn(), b = sn(); return `let x=${a};let y=${b};Math.max(x,y)`; } // variable args
    if (k < 0.78) return `Math.abs(${sn()}-${sn()})`;                                     // expression arg
    if (k < 0.85) return `Math.pow(${1 + Math.floor(rnd() * 6)},${Math.floor(rnd() * 6)})`; // pow (kept small for i64)
    if (k < 0.91) return `Math.sign(${sn()})`;                                            // sign
    if (k < 0.97) { const fn = ["Math.floor", "Math.ceil", "Math.round"][Math.floor(rnd() * 3)]; return `${fn}(${sn()})`; } // floor/ceil/round (identity on ints)
    return `Math.min(Math.max(${sn()},${sn()}),${sn()})`;                                 // nested (same-fn family)
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = nodeRun(p); } catch { continue; }
    ref = String(ref);
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-math: ${checked} Math programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL jsint-math: " + f); process.exit(1); }
