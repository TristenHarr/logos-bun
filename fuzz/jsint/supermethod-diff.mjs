// fuzz/jsint/supermethod — `super.method(...)` calls from a child method, and the filtering of engine-
// internal property keys out of Object.keys/values/entries. super.M() in a non-constructor method returned
// NaN (only super(...) in a constructor was handled). Fix: classWalk stores each class's own methods under
// `this.__msuper_<C>_<m>` (survives a subclass override) and rewrites `super . M (` in a child's method
// bodies to `this . __msuper_<parent>_M (`, so this-binding falls out and the parent's version is reached.
// Those `__msuper_` records (plus `__get_`/`__set_` accessor records) must not leak through Object.keys —
// added an internal-key filter (a real user `__foo` key is preserved; only the reserved engine prefixes are
// dropped). Exercises super-call chains, polymorphic dispatch (parent method calling this.overridden()),
// super+this together, and Object.keys of class instances / plain objects / getter classes, vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 200), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = 1 + ri(20), b = 1 + ri(20), k = ri(8);
    if (k === 0) return `(function(){class A{v(){return ${a}}}class B extends A{v(){return super.v()+${b}}}return new B().v()})()`;
    if (k === 1) return `(function(){class A{v(){return ${a}}}class B extends A{v(){return super.v()*${b}}}return new B().v()})()`;
    if (k === 2) return `(function(){class A{g(){return "A"}}class B extends A{g(){return super.g()+"B"}}class C extends B{g(){return super.g()+"C"}}return new C().g()})()`;   // 3-level super chain
    if (k === 3) return `(function(){class A{constructor(x){this.x=x}s(){return this.x}}class B extends A{s(){return super.s()+${b}}}return new B(${a}).s()})()`;   // super + this
    if (k === 4) return `(function(){class Sh{area(){return 0}desc(){return this.area()}}class Sq extends Sh{constructor(s){super();this.s=s}area(){return this.s*this.s}}return new Sq(${a}).desc()})()`;   // polymorphic dispatch
    if (k === 5) return `(function(){class A{add(p,q){return p+q}}class B extends A{add(p,q){return super.add(p,q)*2}}return new B().add(${a},${b})})()`;   // super.method WITH arguments
    if (k === 6) return `(function(){class C{constructor(){this._v=${a}}get val(){return this._v}}return Object.keys(new C()).join(",")})()`;   // getter class keys (no __get_ leak)
    return `(function(){const o={a:${a},f(){return 1},__z:${b}};return Object.keys(o).sort().join(",")})()`;   // plain object: method + user __ key preserved
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-supermethod: ${checked} super.method + internal-key-filter programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-supermethod: " + f); process.exit(1); }
