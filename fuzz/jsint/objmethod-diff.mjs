// fuzz/jsint/objmethod-diff — ES2015 object method SHORTHAND and ES5 accessors: `{ m(){…} }`,
// `{ m(a,b){…} }`, `{ get x(){…} }`, `{ set x(v){…} }`, mixed with ordinary `key: value` entries and
// `this`. These desugar (in normalizeJs, before resolveCalls could eat a bare `name()` as a call) to the
// `key: function(){}` / `__get_x`/`__set_x` slot form the object machinery already runs. `get`/`set` used
// as ORDINARY keys (`{get: 1}`) must stay ordinary — checked as a regression. Diffed vs Node.
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
const dir = mkdtempSync(join(tmpdir(), "objm-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 200), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = 1 + ri(20), b = 1 + ri(20);
    const k = ri(8);
    if (k === 0) return `let o={m(){return ${a};}};console.log(o.m());`;
    if (k === 1) return `let o={x:${a},greet(){return this.x+${b};}};console.log(o.greet());`;
    if (k === 2) return `let o={add(p,q){return p+q;}};console.log(o.add(${a},${b}));`;
    if (k === 3) return `let o={get v(){return ${a};}};console.log(o.v);`;
    if (k === 4) return `let o={n:${a},get sq(){return this.n*this.n;}};console.log(o.sq);`;
    if (k === 5) return `let o={_v:${a},get v(){return this._v;},set v(w){this._v=w;}};o.v=${b};console.log(o.v);`;
    if (k === 6) return `let o={f(){return ${a};},g(){return ${b};}};console.log(o.f()+o.g());`;
    return `let o={get:${a},set:${b}};console.log(o.get+o.set);`;  // get/set as ordinary keys — regression
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src), got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-objmethod: ${checked} object-method programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-objmethod: " + f); process.exit(1); }
