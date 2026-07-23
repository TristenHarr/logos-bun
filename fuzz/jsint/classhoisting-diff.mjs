// fuzz/jsint/classhoisting — the interaction between function hoisting and class desugaring. A class
// desugars to `__static_C_m = function… ; function C(…){…}` with the statics emitted BEFORE the
// constructor; they rely on C being undefined until the ctor line runs, so `new C` in a static
// resolves at call time. The hoisting pre-pass must NOT hoist a class constructor (JS classes aren't
// hoisted) — else the static's function-literal RHS substitute-captures the ctor value and `new C`
// breaks. Meanwhile a REAL forward-referenced function declaration in the same block MUST still hoist.
// This locks both halves together across top-level and function-body scopes.
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
    const k = ri(6);
    if (k === 0) { // class static factory, called before/after — IIFE
      const v = ri(50);
      return `(function(){ class A{constructor(x){this.x=x} static of(v){return new A(v)}} return A.of(${v}).x })()`;
    }
    if (k === 1) { // class static + a forward-referenced plain function together
      const v = ri(50), a = ri(20);
      return `(function(){ let r = pre(${a}); class A{constructor(x){this.x=x} static of(v){return new A(v)}} function pre(n){return n+1} return r + A.of(${v}).x })()`;
    }
    if (k === 2) { // static method that builds via another static
      const v = ri(50);
      return `(function(){ class A{constructor(x){this.x=x} static of(v){return new A(v)} static twice(v){return A.of(v*2)}} return A.twice(${v}).x })()`;
    }
    if (k === 3) { // extends + super, plus a hoisted helper
      const v = ri(30);
      return `(function(){ let h = help(${v}); class A{constructor(x){this.x=x}} class B extends A{constructor(x){super(x)}} function help(n){return n*3} return h + new B(${v}).x })()`;
    }
    if (k === 4) { // instance method + static, count both
      const v = ri(20);
      return `(function(){ class A{constructor(x){this.x=x} inc(){return this.x+1} static of(v){return new A(v)}} let a=A.of(${v}); return a.inc() })()`;
    }
    // k === 5: top-level (via __js) class static assigned then read, ending in an expression
    const v = ri(50);
    return `class A{constructor(x){this.x=x} static of(v){return new A(v)}}; let a=A.of(${v}); a.x`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-classhoisting: ${checked} class+hoisting programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-classhoisting: " + f); process.exit(1); }
