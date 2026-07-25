// fuzz/jsint/thischainmethod — a method call on a 2+level `this`-member chain (this.state.items.push(x),
// this.m.x.map(...), this.o.a.b.push(...)) — the ubiquitous OO/store pattern. The class desugar installs
// methods BEFORE the constructor body sets fields, and the member-assign path evaluated the method's
// function-literal RHS via jsEvalIn, which substituted `this` and evaluated the body at INSTALL time —
// but the field wasn't set yet, so a 2-level chain hit undefined.x and crashed (1-level yielded
// undefined, no crash). The member-assign path now defers a function-literal RHS via fnArgValRaw
// (funcValueOf without substitute), so the body runs only at call time. Diffed vs Node (`bun run`).
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "tcm-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = 1 + ri(6), b = 1 + ri(9), k = ri(7);
    if (k === 0) return `class C{constructor(){this.m={x:[]}}add(v){this.m.x.push(v)}}const c=new C();${Array.from({length:a},(_,i)=>`c.add(${i});`).join("")}console.log(c.m.x.join(","))`;
    if (k === 1) return `class Store{constructor(){this.state={items:[]}}add(x){this.state.items.push(x)}get(){return this.state.items.length}}const s=new Store();c:for(let i=0;i<${a};i++)s.add(i);console.log(s.get())`;
    if (k === 2) return `class C{constructor(){this.m={x:[${b}]}}dbl(){return this.m.x.map(v=>v*2).join(",")}}console.log(new C().dbl())`;
    if (k === 3) return `class C{constructor(){this.o={a:{b:[1]}}}f(){this.o.a.b.push(${a})}}const c=new C();c.f();console.log(c.o.a.b.length)`;
    if (k === 4) return `class V{constructor(x,y){this.x=x;this.y=y}add(o){return new V(this.x+o.x,this.y+o.y)}}let r=new V(${a},${b}).add(new V(${b},${a}));console.log(r.x+","+r.y)`; // regression: this in args
    if (k === 5) return `let base=${b};let o={};o.f=function(){return base+${a}};console.log(o.f())`;   // regression: closure capture on member
    return `class C{constructor(){this.n=${a}}g(){return this.n*2}}console.log(new C().g())`;             // regression: simple method
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
  if (!fails.length) console.log(`PASS jsint-thischainmethod: ${checked} this-chain-method programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-thischainmethod: " + f); process.exit(1); }
