// fuzz/jsint/tokenize-diff — the P7 JS engine accepting REAL (unspaced) JS source
// via its tokenizer: jsExec = normalizeJs + jsRun, differential-fuzzed vs Node
// eval. Generates full programs (let/while/if-else/expressions), MINIFIES them
// (strips spaces around operators, as real minified JS), and demands jsExec agree
// with Node on the minified source — proving the tokenizer reconstructs tokens.
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
// Reference: eval the (spaced) program via an IIFE returning the final expression.
const nodeRun = (spaced) => { const parts = spaced.split(" ; "); const body = parts.slice(0, -1).map((s) => s + ";").join(" ") + " return (" + parts[parts.length - 1] + ");"; return eval("(()=>{" + body + "})()"); };
// Minify: strip whitespace around operators/punctuation (keeps keyword spaces).
const minify = (spaced) => spaced.replace(/\s*([-+*%<>=!&|?:(){};])\s*/g, "$1");
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 800), rnd = mul(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const program = () => {
    const N = 2 + Math.floor(rnd() * 6), acc0 = String(Math.floor(rnd() * 5)), upd = pick(["+", "*", "-"]);
    const cmp = pick(["<", ">", "<=", ">=", "==", "!="]), cond = `i ${cmp} ${1 + Math.floor(rnd() * N)}`;
    const bk = rnd();
    const body = bk < 0.4 ? `acc = acc ${upd} i ; i = i + 1`
      : bk < 0.7 ? `if ( ${cond} ) { acc = acc ${upd} i } ; i = i + 1`
      : `if ( ${cond} ) { acc = acc + i } else { acc = acc + 1 } ; i = i + 1`;
    const fin = rnd() < 0.5 ? "acc" : `acc ${pick(["<", ">", "<=", ">=", "==", "!="])} ${Math.floor(rnd() * 60)}`;
    return [`let acc = ${acc0}`, `let i = 1`, `while ( i <= ${N} ) { ${body} }`, fin].join(" ; ");
  };
  let checked = 0;
  for (let i = 0; i < n; i++) {
    const spaced = program();
    let ref; try { ref = nodeRun(spaced); } catch { continue; }
    if (typeof ref === "number" && (!Number.isInteger(ref) || Math.abs(ref) > 1e15)) continue;
    ref = String(ref);
    const src = minify(spaced);            // the real unspaced JS our tokenizer must handle
    const got = run(src);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(src)}): ours=${got} node=${ref}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-tokenize: ${checked} MINIFIED programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL jsint-tokenize: " + f); process.exit(1); }
