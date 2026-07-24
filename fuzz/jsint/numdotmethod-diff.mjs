// fuzz/jsint/numdotmethod — a method call directly on a numeric literal. The `255..toString(16)`
// double-dot idiom (the first `.` is the number's trailing decimal point — `255.` === 255 — and the
// second `.` is the member access) tokenized to a broken `255 . . toString`; normJs kept a post-digit
// `.` only when the NEXT char was another digit (`255.5`), so the double-dot fell through to two operator
// dots. Fixed by treating `digit . .` as a trailing decimal point (dropped) followed by member access.
// This exercises the double-dot, the spaced `255 .m()`, the parenthesized `(255).m()`, and decimal
// `3.14.toFixed()` forms across toString(radix)/toFixed/toLocaleString, diffed vs Node.
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
    const int = 1 + ri(100000);
    const radix = [2, 8, 16, 10][ri(4)];
    const k = ri(6);
    if (k === 0) return `(function(){return ${int}..toString(${radix})})()`;      // double-dot
    if (k === 1) return `(function(){return ${int} .toString(${radix})})()`;       // spaced dot
    if (k === 2) return `(function(){return (${int}).toString(${radix})})()`;      // parenthesized
    if (k === 3) return `(function(){return ${int}..toLocaleString()})()`;         // double-dot toLocaleString
    if (k === 4) { const f = ri(4); return `(function(){return (${int}/7).toFixed(${f})})()`; } // toFixed on expr
    return `(function(){return ${int / 100}.toFixed(${ri(3)})})()`;                // decimal literal method
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-numdotmethod: ${checked} numeric-literal method-call programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-numdotmethod: " + f); process.exit(1); }
