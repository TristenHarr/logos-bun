// fuzz/jsint/compoundexpr — compound assignment used as an EXPRESSION (its value), not a bare statement:
// `let y=(x+=5)`, `return x*=2`, `x ??= d`, `o.n+=3`, a forEach body `acc+=n`. firstTopAssignIdx only
// recognised bare `=`, so a compound assign in value position fell through to NaN. jsEvalIn now rewrites
// `LHS OP= RHS` → `LHS = LHS baseop ( RHS )` (parens preserve the RHS precedence, e.g. x*=a+b stays
// x*(a+b)); logical assigns map to x||(RHS) / x&&(RHS) / x??(RHS). Member targets persist; the returned
// value matches Node. (A compound assign directly inside an array-literal element, [x+=1], is a known
// niche gap — element eval goes through evalValue, not jsEvalIn — and is not exercised here.)
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
  const arith = ["+=", "-=", "*=", "/=", "%="];
  const program = () => {
    const a = 1 + ri(20), b = 1 + ri(9), op = arith[ri(arith.length)], k = ri(8);
    if (k === 0) return `let x=${a};let y=(x${op}${b});y`;
    if (k === 1) return `function f(){let x=${a};return x${op}${b}}f()`;
    if (k === 2) return `let x=${a};let y=(x*=${b}+2);y`;                     // precedence
    if (k === 3) return `let o={n:${a}};let y=(o.n${op}${b});o.n+","+y`;      // member persists
    if (k === 4) return `let arr=[${a}];let y=(arr[0]${op}${b});arr[0]+","+y`;
    if (k === 5) return `let acc=0;[${1 + ri(9)},${1 + ri(9)},${1 + ri(9)}].forEach(v=>{acc+=v});acc`;
    if (k === 6) { const v = ri(2) ? a : "null"; return `let x=${v};let y=(x??=${b});String(y)`; }
    return `let x=${a};let y=(x||=${b});y`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String((0, eval)(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-compoundexpr: ${checked} compound-assign-expression programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-compoundexpr: " + f); process.exit(1); }
