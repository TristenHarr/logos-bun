// fuzz/jsint/indexexpr-diff — a bracket index whose expression contains a MEMBER ACCESS: the ubiquitous
// last-element idiom `arr[arr.length-1]`, `s[s.length-1]`, `a[a.length-2]`, computed keys `o[keys[i]]`,
// and `grid[grid.length-1][0]`. resolveArrays runs before resolveProps in evalResolved, so it evaluated
// the index through the shallow evalValue with `.length` still unresolved and parseInt PANICKED (a hard
// crash). Fixed by running the index through the full evalResolved chain (evalIndex) — its variables are
// already substituted to values by that point, so no env is needed. Plain/arithmetic/temp-var indices,
// nested indexing, and string keys are re-checked. Diffed vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const NODE = process.execPath;
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dir = mkdtempSync(join(tmpdir(), "ix-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 200), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const arr = () => `[${Array.from({ length: 2 + ri(4) }, () => 1 + ri(50)).join(",")}]`;
  const program = () => {
    const a = arr(), off = 1 + ri(2);
    const k = ri(7);
    if (k === 0) return `let m=${a};console.log(m[m.length-1]);`;
    if (k === 1) return `let m=${a};console.log(m[m.length-${off}]);`;
    if (k === 2) return `let s="abcdef";console.log(s[s.length-1]);`;
    if (k === 3) return `let m=${a};console.log(m[m.length]);`;                       // out of range -> undefined
    if (k === 4) return `let o={a:1,b:2,c:3};let ks=["a","b","c"];console.log(o[ks[${ri(3)}]]);`;
    if (k === 5) return `let g=[${a},${a}];console.log(g[g.length-1][0]);`;
    return `let m=${a};console.log(m[${ri(3)}]+"/"+m[m.length-1]);`;                  // mixed literal + computed
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src), got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-indexexpr: ${checked} index-expr programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-indexexpr: " + f); process.exit(1); }
