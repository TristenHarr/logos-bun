// fuzz/jsint/classinherit-diff — class inheritance (E1.4): `extends`, `super(args)`, and
// `instanceof`. A subclass constructor's super(args) runs the parent constructor with `this`
// (inheriting its fields + methods), the subclass's own methods override the parent's, and
// `instanceof` tests the full ancestry chain (subclass instance IS an instance of every
// ancestor). Diffed vs Node.
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
    const k = ri(7), a = sn(), b = sn();
    if (k === 0) return `class A{constructor(){this.x=${a}}}class B extends A{constructor(){super();this.y=${b}}}let o=new B();o.x+o.y`;
    if (k === 1) return `class A{constructor(x){this.x=x}}class B extends A{constructor(x,y){super(x);this.y=y}}let o=new B(${a},${b});o.x+o.y`;
    if (k === 2) return `class A{constructor(){this.x=${a}}m(){return this.x}}class B extends A{constructor(){super();this.y=${b}}}let o=new B();o.m()+o.y`;
    if (k === 3) return `class A{constructor(){this.x=${a}}}class B extends A{constructor(){super()}}let o=new B();o instanceof A`;
    if (k === 4) return `class A{constructor(){this.x=${a}}}class B extends A{constructor(){super()}}let o=new B();o instanceof B`;
    if (k === 5) return `class A{v(){return ${a}}}class B extends A{constructor(){super()}v(){return ${b}}}let o=new B();o.v()`;
    return `class A{constructor(){super_placeholder}}`.replace("super_placeholder", `this.n=${a}`) + `class B extends A{constructor(){super();this.n=this.n+${b}}}let o=new B();o.n`;
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
  if (!fails.length) console.log(`PASS jsint-classinherit: ${checked} inheritance programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-classinherit: " + f); process.exit(1); }
