// fuzz/jsint/not-diff — the P7 JS engine's logical NOT `!`, differential-fuzzed vs
// Node eval. `!` on booleans, on a parenthesized comparison `!(a>b)`, on numeric
// truthiness (`!5`=false, `!0`=true), on null/undefined, and `!` feeding a `&&`
// chain or a ternary condition. notOf implements JS falsiness (false/0/""/null/
// undefined -> true, else false). NOT fuzzed: `!(a&&b)` (the &&-split isn't paren-
// aware yet) or `!""` (empty-string tagging edge) — separate items.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const program = () => {
    const k = rnd();
    if (k < 0.2) return `!${pick(["true", "false"])}`;                                        // bare boolean
    if (k < 0.36) { const b = pick(["true", "false"]); return `let b=${b};!b`; }               // stored boolean
    if (k < 0.56) { const a = Math.floor(rnd() * 8), b = Math.floor(rnd() * 8), op = pick(["<", ">", "<=", ">=", "==", "!="]); return `!(${a}${op}${b})`; } // !(comparison)
    if (k < 0.7) return `!${Math.floor(rnd() * 4)}`;                                            // numeric truthiness (0..3)
    if (k < 0.8) return `!${pick(["null", "undefined"])}`;                                      // !null / !undefined
    if (k < 0.9) { const a = Math.floor(rnd() * 6), b = Math.floor(rnd() * 6); return `!(${a}>${b})&&${pick(["true", "false"])}`; } // ! into &&
    const a = Math.floor(rnd() * 6), b = Math.floor(rnd() * 6); return `!(${a}>${b})?10:20`;   // ! as ternary condition
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
  if (!fails.length) console.log(`PASS jsint-not: ${checked} logical-NOT programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL jsint-not: " + f); process.exit(1); }
