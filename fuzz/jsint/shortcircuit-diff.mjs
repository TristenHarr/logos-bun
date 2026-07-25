// fuzz/jsint/shortcircuit — ||, ?? and && must SHORT-CIRCUIT: the right operand (and its side effects /
// calls) runs only when the left doesn't already decide the result. jsEvalIn resolved calls eagerly on
// the whole expression before the logical value-picker ran, so a call in the not-taken branch fired
// (memoize's cache[n]??(cache[n]=fn(n)) called fn on every hit). jsEvalIn now evaluates ||/??/&& lazily
// (topBinIdx splits at the top-level operator; only the taken operand is evaluated). Side effects are
// observed through a HEAP object/array flag (a captured-scalar mutation through a bare call is a
// separate pre-existing gap and is not exercised here). Also checks the value each operator returns.
// Diffed vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 260), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const vals = ["0", "5", '""', '"x"', "null", "undefined", "true", "false", "NaN"];
  const program = () => {
    const a = vals[ri(vals.length)], b = vals[ri(vals.length)], k = ri(8);
    if (k === 0) return `String(${a}||${b})`;
    if (k === 1) return `String(${a}&&${b})`;
    if (k === 2) return `String(${a}??${b})`;
    if (k === 3) return `String(${a}||${b}||"z")`;
    if (k === 4) return `let s={c:0};let f=()=>{s.c++;return 9};let r=${a}||f();s.c`;   // call fires iff a falsy
    if (k === 5) return `let s={c:0};let f=()=>{s.c++;return 9};let r=${a}&&f();s.c`;   // call fires iff a truthy
    if (k === 6) return `let s={c:0};let f=()=>{s.c++;return 9};let r=${a}??f();s.c`;   // call fires iff a nullish
    return `const memo=fn=>{const c={};return n=>c[n]??(c[n]=fn(n))};let s={c:0};const g=memo(n=>{s.c++;return n});g(3);g(3);s.c`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String((0, eval)(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-shortcircuit: ${checked} short-circuit programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-shortcircuit: " + f); process.exit(1); }
