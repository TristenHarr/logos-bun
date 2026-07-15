// fuzz/jsint/nan-diff — the NaN model. Arithmetic on a non-numeric operand yields NaN
// (not a crash): undefined+n, a missing destructured key / missing arg used in math,
// 0/0. NaN propagates through further arithmetic; boolean/null coerce (null->0, true->1,
// false->0); NaN is falsy; typeof NaN === "number"; and NaN is never equal to anything
// (x!==x is the true self-check, x===x is false). Comparison with undefined no longer
// panics (undefined<n is false, undefined==undefined is true). Diffed vs Node.
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
const nodeRun = (p) => {
  let depth = 0, parts = [], cur = "";
  for (const c of p) { if (c === "{" || c === "(" || c === "[") depth++; else if (c === "}" || c === ")" || c === "]") depth--; if (c === ";" && depth === 0) { parts.push(cur); cur = ""; } else cur += c; }
  parts.push(cur);
  const body = parts.slice(0, -1).map((s) => s + ";").join("") + " return (" + parts[parts.length - 1] + ");";
  return eval("(()=>{" + body + "})()");
};
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const sn = () => 1 + ri(9);
  const op = () => ["+", "-", "*"][ri(3)];
  const program = () => {
    const k = ri(10);
    if (k === 0) return `${sn()}${op()}undefined`;                                       // undefined -> NaN
    if (k === 1) return `let {a,b,c}={a:${sn()},b:${sn()}};a${op()}c`;                     // missing key -> NaN
    if (k === 2) return `function f(a,b){return a${op()}b};f(${sn()})`;                    // missing arg -> NaN
    if (k === 3) return `let x=${sn()}+undefined;x${op()}${sn()}`;                         // NaN propagates
    if (k === 4) return `null+${sn()}`;                                                    // null -> 0
    if (k === 5) return `${ri(2) ? "true" : "false"}+${sn()}`;                             // bool -> 1/0
    if (k === 6) return `let x=${sn()}+undefined;x!==x`;                                   // self-check true
    if (k === 7) return `let n=${sn()};n===n`;                                            // non-NaN self-check
    if (k === 8) return `let x=${sn()}+undefined;x?${sn()}:${sn()}`;                       // NaN falsy
    return `let x=${sn()}+undefined;typeof x`;                                             // typeof NaN = number
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
  if (!fails.length) console.log(`PASS jsint-nan: ${checked} NaN-model programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-nan: " + f); process.exit(1); }
