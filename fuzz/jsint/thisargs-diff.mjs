// fuzz/jsint/thisargs — `this` used inside the ARGUMENTS of a method / constructor call, the immutable-
// update & clone idiom: class C{ ... m(){ return new C(this.v) } }, Vec.add(o){ return new Vec(this.x+o.x,
// …) }, o.pass(f){ return f(this.x) }. callMethod evaluated the args in the CALLEE's env (this = the new/
// receiver instance) instead of the caller's, so this.x read the wrong (usually empty) instance → NaN /
// undefined. callMethod now evaluates args in the caller's env (matching callFn); the callee's this still
// binds only the body. Diffed vs Node. Plain method/ctor calls (this in the BODY) are regressions.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 260), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = 1 + ri(20), b = 1 + ri(20), k = ri(8);
    if (k === 0) return `class P{constructor(n){this.n=n}clone(){return new P(this.n)}}new P(${a}).clone().n`;
    if (k === 1) return `class P{constructor(n){this.n=n}twice(){return new P(this.n*2)}}new P(${a}).twice().n`;
    if (k === 2) return `class V{constructor(x,y){this.x=x;this.y=y}add(o){return new V(this.x+o.x,this.y+o.y)}}let r=new V(${a},${b}).add(new V(${a},${b}));r.x+","+r.y`;
    if (k === 3) return `class C{constructor(v){this.v=v}map(f){return new C(f(this.v))}}new C(${a}).map(x=>x+${b}).v`;
    if (k === 4) return `let o={x:${a},make(){return {y:this.x}}};o.make().y`;
    if (k === 5) return `let o={x:${a},pass(f){return f(this.x)}};o.pass(v=>v+${b})`;
    if (k === 6) return `class P{constructor(n){this.n=n}get(){return this.n}}new P(${a}).get()`;   // regression: this in body
    return `let o={a:${a},b:${b},sum(){return this.a+this.b}};o.sum()`;                              // regression: method shorthand
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String((0, eval)(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-thisargs: ${checked} this-in-args programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-thisargs: " + f); process.exit(1); }
