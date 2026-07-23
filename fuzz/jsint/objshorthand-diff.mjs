// fuzz/jsint/objshorthand — ES2015 object property shorthand: `{n}` ≡ `{n:n}`, `{a,b}`, and any mix
// with normal `key:value` pairs and method shorthand (`{n, sq:n*n, m(){…}}`). The engine substitutes
// free variables BEFORE building the object, and its key-position guard only protected a name followed
// by `:` — so a bare shorthand `n` (followed by `,`/`}`) was read as a numeric KEY with a NaN value
// (`{n}` → `{"5":NaN}`). Fixed by desugaring shorthand to `n : n` in `domWalk` (before substitution),
// where a bare identifier at an object key position whose next token is `,`/`}`/end expands so the KEY
// stays a name and the VALUE resolves to the variable. Destructuring patterns (`let {a}=o`) are a `b`/
// non-`o` frame in domStack and are correctly left untouched. Node's JSON.stringify (source/insertion
// key order in both) is the oracle.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 400), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const k = ri(8);
    if (k === 0) return `(function(){ let n=${ri(99)}; return JSON.stringify({n}) })()`;
    if (k === 1) return `(function(){ let a=${ri(9)},b=${ri(9)},c=${ri(9)}; return JSON.stringify({a,b,c}) })()`;
    if (k === 2) return `(function(){ let n=${ri(9)}; return JSON.stringify({n,sq:n*n}) })()`;
    if (k === 3) return `(function(){ let a=${ri(9)},c=${ri(9)}; return JSON.stringify({a,b:${ri(9)},c}) })()`;
    if (k === 4) return `(function(){ let name=${JSON.stringify("v" + ri(9))}; return ({name}).name })()`;
    if (k === 5) return `(function(){ let y=${ri(9)}; return JSON.stringify({x:{y}}) })()`;
    if (k === 6) return `(function(){ let x=${ri(9)}; return JSON.stringify([{x},{x}]) })()`;
    return `(function(){ let a=${ri(9)},b=${ri(9)}; let o={a,b,sum(){return a+b}}; return o.a+"/"+o.b+"/"+o.sum() })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-objshorthand: ${checked} object-shorthand programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-objshorthand: " + f); process.exit(1); }
