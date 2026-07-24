// fuzz/jsint/arrowassign — an arrow whose EXPRESSION body is an assignment: `x => s += x`, `x => o.k = x`.
// buildArrow wrapped an expression body as `return <body>`, so `s += x` was evaluated as an expression
// (yielding the value) without mutating s — a forEach callback's scalar accumulator written that way stayed
// 0. Fixed: an assignment expression body with a simple-name or member/index lhs is emitted as a mutating
// STATEMENT plus `return <lhs>`, so the write actually happens (and forEach's env write-back persists it)
// while the arrow still yields the assigned value. A ternary/comparison/plain-value body stays a plain
// `return` (guarded by the lhs shape). Exercises forEach scalar/member accumulation via arrow-expr bodies
// and re-checks map/filter/reduce/ternary arrows as regressions, diffed vs Node.
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
    const arr = `[${Array.from({ length: 2 + ri(4) }, () => ri(20)).join(",")}]`;
    const k = ri(9);
    if (k === 0) return `(function(){let s=0;${arr}.forEach(x=>s+=x);return s})()`;               // scalar += arrow-expr
    if (k === 1) return `(function(){let p=1;${arr}.forEach(x=>p*=x);return p})()`;                // scalar *= arrow-expr
    if (k === 2) return `(function(){const o={t:0};${arr}.forEach(x=>o.t+=x);return o.t})()`;      // member += arrow-expr
    if (k === 3) return `(function(){let last=-1;${arr}.forEach(x=>last=x);return last})()`;       // plain = arrow-expr
    if (k === 4) return `(function(){let s=0;const a=${arr};Object.keys(a).forEach(k=>s+=a[k]);return s})()`; // keys→index→+=
    if (k === 5) return `(function(){return ${arr}.map(x=>x*2).join(",")})()`;                     // regression: map
    if (k === 6) return `(function(){return ${arr}.filter(x=>x>${ri(20)}).length})()`;             // regression: filter (comparison)
    if (k === 7) return `(function(){return ${arr}.map(x=>x>${ri(10)}?x:0).join(",")})()`;         // regression: ternary
    return `(function(){return ${arr}.reduce((a,b)=>a+b,0)})()`;                                    // regression: reduce
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-arrowassign: ${checked} arrow-expr-body assignment programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-arrowassign: " + f); process.exit(1); }
