// fuzz/jsint/asiblockbrace — ASI after a BLOCK / declaration `}` glued to a `[` or `(` (minified JS
// with no semicolon/newline): function g(){...}[1,2].map(g), function*g(){...}[...g()], if(c){...}(x),
// for(...){...}(x). The closing brace of a function/class/control body ends the statement, so the
// following [/( starts a NEW statement — it must NOT be read as member access / a call on the block.
// Object-literal braces (x={a:1}[k], return{...}) still continue, so those forms are regressions and
// must stay member access. Diffed vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = 1 + ri(6), b = 1 + ri(6), c = 1 + ri(6), k = ri(11);
    if (k === 0) return `function g(x){return x*${a}}[${a},${b},${c}].map(g).join(",")`;
    if (k === 1) return `function g(){return ${a}}[${a},${b}].map(g).length`;
    if (k === 2) return `function g(){return ${a}}(g()+${b})`;
    if (k === 3) return `function*g(){for(let i=0;i<${a + 1};i++)yield i}[...g()].join(",")`;
    if (k === 4) return `function*g(){yield*[${a},${b}];yield*[${c}]}[...g()].join(",")`;
    if (k === 5) return `let r=0;if(${a}<${b}){r=${c}}[1].forEach(x=>r+=x);r`;
    if (k === 6) return `let r=0;for(let i=0;i<${a};i++){r++}[1,2].forEach(x=>r+=x);r`;
    if (k === 7) return `let o={a:${a}}[${JSON.stringify("a")}];String(o)`;           // regression: object member
    if (k === 8) return `function h(){return{x:${a}}}h().x`;                          // regression: return object
    if (k === 9) return `let s=(function(){return ${a}})();s`;                        // regression: parenthesized IIFE
    return `class C{m(){return ${a}}}new C().m()`;                                    // regression: class decl
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String((0, eval)(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-asiblockbrace: ${checked} block-brace ASI programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-asiblockbrace: " + f); process.exit(1); }
