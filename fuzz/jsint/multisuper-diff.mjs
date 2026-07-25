// fuzz/jsint/multisuper — super.method() that walks PAST an intermediate class which does not override
// the method. A derived class's `super.m()` targets `__msuper_<Parent>_m`, but a middle class that only
// inherits m never created that binding, so the call returned undefined (→ NaN / wrong string). Each
// class now copies its parent's inherited `__msuper_*` table into its own namespace after super(), before
// its own overrides, so super chains resolve through non-overriding ancestors at any depth. Single-level
// super and ctor chaining must be unchanged. Diffed vs Node via a module file.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dir = OURS ? mkdtempSync(join(tmpdir(), "ms-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = ri(20), b = ri(20), k = ri(6);
    if (k === 0) return `class Base{greet(){return ${a}}}class Mid extends Base{}class Leaf extends Mid{greet(){return super.greet()+${b}}}console.log(new Leaf().greet())`;
    if (k === 1) return `class A{m(){return "A"}}class B extends A{m(){return super.m()+"B"}}class C extends B{m(){return super.m()+"C"}}console.log(new C().m())`;
    if (k === 2) return `class A{v(){return ${a}}}class B extends A{}class C extends B{}class D extends C{v(){return super.v()*2}}console.log(new D().v())`;
    if (k === 3) return `class Base{constructor(){this.s=${a}}f(){return "s="+this.s}}class Mid extends Base{}class Leaf extends Mid{constructor(){super();this.s=${b}}f(){return super.f()+"!"}}console.log(new Leaf().f())`;
    if (k === 4) return `class A{method(){return ${a}}}class B extends A{method(){return super.method()+${b}}}console.log(new B().method())`;  // regression: single-level
    return `class Base{constructor(x){this.x=x}}class Sub extends Base{constructor(x){super(x+${a})}}console.log(new Sub(${b}).x)`;              // regression: ctor chaining
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    const ref = runFile("node", p);
    const got = runFile(OURS, p);
    if (got !== ref) fails.push(`run(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  rmSync(dir, { recursive: true, force: true });
  if (!fails.length) console.log(`PASS jsint-multisuper: ${checked} multi-level super programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-multisuper: " + f); process.exit(1); }
