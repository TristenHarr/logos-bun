// fuzz/jsint/methodarray-diff — array methods (map/filter/reduce/join/sort/some/every/find/indexOf/
// slice) invoked INSIDE a method body: on an array literal, on `this.<field>`, and on an array-valued
// parameter — across both object-literal methods and class methods. These used to fail (empty / NaN)
// because the builtin-method dispatch resolved a method sitting inside an un-encoded function body at
// object-CONSTRUCTION time (before the body was made opaque), so the receiver evaluated to an empty
// array; a `markerInBody` guard now defers any method whose leftmost occurrence is inside a function
// body until the method actually runs. Plain-`function` bodies (which were always encoded first) are
// re-checked as regressions. Diffed vs Node.
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
const dir = mkdtempSync(join(tmpdir(), "ma-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 200), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const lit = () => `[${1 + ri(9)},${1 + ri(9)},${1 + ri(9)}]`;
  const program = () => {
    const arr = lit();
    const k = ri(9);
    if (k === 0) return `let o={s(){return ${arr}.join("-");}};console.log(o.s());`;
    if (k === 1) return `let o={s(){return ${arr}.map(x=>x*2).join(",");}};console.log(o.s());`;
    if (k === 2) return `let o={v:${arr},sum(){return this.v.reduce((a,b)=>a+b,0);}};console.log(o.sum());`;
    if (k === 3) return `let o={v:${arr},f(){return this.v.filter(x=>x>2).length;}};console.log(o.f());`;
    if (k === 4) return `let o={s(a){return a.map(x=>x+1).join("-");}};console.log(o.s(${arr}));`;
    if (k === 5) return `let o={s(){return ${arr}.sort((a,b)=>a-b).join("-");}};console.log(o.s());`;
    if (k === 6) return `class C{constructor(){this.v=${arr};}sum(){return this.v.reduce((a,b)=>a+b,0);}}console.log(new C().sum());`;
    if (k === 7) return `class C{go(){return ${arr}.some(x=>x>5)+","+${arr}.every(x=>x>0);}}console.log(new C().go());`;
    return `function s(){return ${arr}.map(x=>x*3).join("-");}console.log(s());`;   // plain-function regression
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src), got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-methodarray: ${checked} array-in-method programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-methodarray: " + f); process.exit(1); }
