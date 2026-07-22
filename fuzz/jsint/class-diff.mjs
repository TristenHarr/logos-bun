// fuzz/jsint/class-diff — `class` syntax (E1). A class desugars to a constructor function whose
// methods are assigned onto `this` (instance-own function values bound dynamically). Covers
// constructor field init, single/multiple methods, method arithmetic with parentheses (the
// precedence case `2*(this.w+this.h)`), mutating methods, array fields with push, and distinct
// per-instance identity/state. Diffed vs Node.
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
const nodeRun = (p) => {
  let depth = 0, parts = [], cur = "";
  for (const c of p) { if (c === "{" || c === "(" || c === "[") depth++; else if (c === "}" || c === ")" || c === "]") depth--; if (c === ";" && depth === 0) { parts.push(cur); cur = ""; } else cur += c; }
  parts.push(cur);
  const body = parts.slice(0, -1).map((s) => s + ";").join("") + " return (" + parts[parts.length - 1] + ");";
  return eval("(()=>{" + body + "})()");
};
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const sn = () => 1 + ri(9);
  const program = () => {
    const k = ri(8), a = sn(), b = sn();
    if (k === 0) return `class A{constructor(x){this.x=x}get(){return this.x}}let a=new A(${a});a.get()`;
    if (k === 1) return `class C{constructor(){this.n=${a}}}let c=new C();c.n`;
    if (k === 2) return `class Pt{constructor(x,y){this.x=x;this.y=y}sum(){return this.x+this.y}}let p=new Pt(${a},${b});p.sum()`;
    if (k === 3) return `class R{constructor(w,h){this.w=w;this.h=h}area(){return this.w*this.h}peri(){return 2*(this.w+this.h)}}let r=new R(${a},${b});r.area()+r.peri()`;
    if (k === 4) return `class Ctr{constructor(v){this.v=v}inc(){this.v=this.v+1;return this.v}}let c=new Ctr(${a});c.inc();c.inc()`;
    if (k === 5) return `class Q{constructor(){this.items=[]}add(x){this.items.push(x)}count(){return this.items.length}}let q=new Q();q.add(${a});q.add(${b});q.count()`;
    if (k === 6) return `class A{constructor(v){this.v=v}}let a=new A(${a});let b=new A(${b});a.v+b.v`;
    return `class Acc{constructor(s){this.s=s}addTwice(k){this.s=this.s+k+k;return this.s}}let x=new Acc(${a});x.addTwice(${b})`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = nodeRun(p); } catch { continue; }
    ref = String(ref);
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-class: ${checked} class programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-class: " + f); process.exit(1); }
