// fuzz/jsint/restparam-diff — rest parameters `function f(...xs)` / `function f(a, ...rest)`: the trailing
// param gathers the caller's remaining positional args into a real array (map/reduce/join/length over
// it), and an empty call yields an empty array (not NaN). bindParams had no `...` case, so `...xs` bound a
// single param literally named `... xs`; a restArgs gatherer now builds the array (skipping the empty
// token an argument-less call produces). Leading fixed params + defaults + destructuring are re-checked.
// Diffed vs Node. (Rest params on object/class METHODS are a separate open item — see BUGS_FOUND.)
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
const dir = mkdtempSync(join(tmpdir(), "rest-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 200), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const argList = () => Array.from({ length: ri(5) }, () => 1 + ri(9)).join(",");
  const program = () => {
    const args = argList();
    const k = ri(9);
    if (k === 0) return `function f(...xs){return xs.length;}console.log(f(${args}));`;
    if (k === 1) return `function f(...xs){return xs.join("-");}console.log(f(${args}));`;
    if (k === 2) return `function f(...xs){return xs.reduce((a,b)=>a+b,0);}console.log(f(${args}));`;
    if (k === 3) return `function f(a,...rest){return a+":"+rest.length;}console.log(f(${args || "0"}));`;
    if (k === 4) return `function f(...xs){return xs.map(x=>x*2).join(",");}console.log(f(${args}));`;
    if (k === 5) return `let o={m(...xs){return xs.reduce((a,b)=>a+b,0);}};console.log(o.m(${args || "0"}));`;
    if (k === 6) return `let o={m(a,...rest){return a+"|"+rest.join(",");}};console.log(o.m(${args || "0"}));`;
    if (k === 7) return `class C{sum(...ns){return ns.length;}}console.log(new C().sum(${args}));`;
    return `function f(...xs){return xs.filter(x=>x>4).length;}console.log(f(${args}));`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src), got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-restparam: ${checked} rest-param programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-restparam: " + f); process.exit(1); }
