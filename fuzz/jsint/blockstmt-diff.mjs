// fuzz/jsint/blockstmt — a bare BLOCK statement `{ … }` (not attached to if/for/while/function) used to be
// mis-read as an object literal and silently skipped — its statements, and even a `return` inside it, never
// ran. execStmt now recognizes a `{`-leading statement as a block and runs its body (like an if/else block,
// in the current scope; return/throw propagate). Object literals in EXPRESSION position (assigned, returned,
// arrow bodies, method shorthand) and if/for/while blocks are regression controls. Block-scope shadowing is a
// separate limitation shared with if-blocks and is not exercised. Diffed vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dir = OURS ? mkdtempSync(join(tmpdir(), "bs-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = 1 + ri(9), b = 1 + ri(9), k = ri(11);
    if (k === 0) return `{ console.log(${a} + ${b}); }`;
    if (k === 1) return `{ let x = ${a}; console.log(x * 2); }`;
    if (k === 2) return `console.log("A"); { console.log(${a}); } console.log("B");`;
    if (k === 3) return `function f(){ { return ${a}; } } console.log(f())`;
    if (k === 4) return `{ const p = ${a}, q = ${b}; console.log(p + q); }`;
    if (k === 5) return `{ for (let i = 0; i < ${1 + ri(3)}; i++) console.log(i); }`;
    if (k === 6) return `{ if (${a} > ${b}) console.log("gt"); else console.log("le"); }`;
    if (k === 7) return `{ let s = 0; [${a},${b}].forEach(v => s += v); console.log(s); }`;
    // regression controls — object literals in expression position + attached blocks
    if (k === 8) return `const o = { a: ${a}, b: ${b} }; console.log(o.a + o.b)`;
    if (k === 9) return `function g(){ return { v: ${a} } } console.log(g().v)`;
    return `if (true) { console.log(${a}) } for (let i=0;i<${1 + ri(2)};i++) { console.log(i) }`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    const ref = runFile("node", p);
    const got = runFile(OURS, p);
    if (got !== ref) fails.push(`run(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  rmSync(dir, { recursive: true, force: true });
  if (!fails.length) console.log(`PASS jsint-blockstmt: ${checked} block-statement programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-blockstmt: " + f); process.exit(1); }
