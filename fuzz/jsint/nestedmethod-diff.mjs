// fuzz/jsint/nestedmethod-diff — a user method invoked on a receiver that is itself a member or index
// expression: `o.a.m()`, `o.a.b.deep()`, `arr[0].m()`, `o.a.m() + o.b.m()`. The dispatch used to take
// only the SINGLE token before the method (`a`) as the receiver instead of the whole receiver
// expression (`o.a`), so anything deeper than one level returned the raw body / NaN. Fixed by resolving
// the receiver boundary with recvStart/joinRange (the same logic recvExpr uses), which also handles an
// index receiver. Single-level `o.m()`, statics `C.of()`, and `new C().g()` are re-checked. Diffed vs
// Node.
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
const dir = mkdtempSync(join(tmpdir(), "nm-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 200), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = 1 + ri(20), b = 1 + ri(20);
    const k = ri(7);
    if (k === 0) return `let o={a:{m(){return ${a};}}};console.log(o.a.m());`;
    if (k === 1) return `let o={a:{b:{deep(){return ${a}+${b};}}}};console.log(o.a.b.deep());`;
    if (k === 2) return `let arr=[{m(){return ${a};}}];console.log(arr[0].m());`;
    if (k === 3) return `let o={a:{m(){return ${a};}},b:{m(){return ${b};}}};console.log(o.a.m()+o.b.m());`;
    if (k === 4) return `let o={m(){return ${a};}};console.log(o.m());`;                 // single-level regression
    if (k === 5) return `class F{static of(v){return v+${a};}}console.log(F.of(${b}));`;  // static regression
    return `class C{g(){return ${a};}}console.log(new C().g());`;                        // new+method regression
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src), got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-nestedmethod: ${checked} nested-method programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-nestedmethod: " + f); process.exit(1); }
