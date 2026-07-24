// fuzz/jsint/prototype — legacy prototype-based OOP: `Ctor.prototype.m = fn` / `Ctor.prototype.k = v` plus
// `new Ctor()`. new created the instance and ran the constructor with `this` bound, but never linked the
// prototype, so instances couldn't see prototype members. Now `Ctor.prototype.X = …` is recorded as
// `__proto_<Ctor>_<X>` in the env and `new Ctor()` copies every such member onto the fresh instance before
// the constructor runs (an own field shadows it). This fuzzer builds function-constructor + prototype-method
// programs — reading `this`, explicit `this.f = …` mutation, data properties, method chaining — vs Node.
// (`this.f++`/`++this.f` writeback in a method is a separate pre-existing gap, not exercised here.)
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
    const a = ri(90), b = ri(90);
    const k = ri(4);
    if (k === 0) return `(function(){ function P(n){ this.name=n } P.prototype.greet=function(){ return "Hi "+this.name }; return new P("u${a}").greet() })()`;
    if (k === 1) return `(function(){ function A(x){ this.x=x } A.prototype.getX=function(){ return this.x }; A.prototype.dbl=function(){ return this.x*2 }; let o=new A(${a}); return o.getX()+"|"+o.dbl() })()`;
    if (k === 2) return `(function(){ function C(){} C.prototype.val=${a}; C.prototype.tag="t${b}"; let c=new C(); return c.val+":"+c.tag })()`;
    return `(function(){ function T(v){ this.v=v } T.prototype.bump=function(){ this.v=this.v+1; return this }; let t=new T(${a}); t.bump().bump(); return t.v })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-prototype: ${checked} prototype-OOP programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-prototype: " + f); process.exit(1); }
