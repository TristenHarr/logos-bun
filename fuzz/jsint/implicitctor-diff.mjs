// fuzz/jsint/implicitctor — a derived class with NO explicit constructor inherits the parent's:
// `class B extends A {}` → `new B(args)` runs A's constructor with those args. classWalk left cparams/cbody
// empty, so the synthesized ctor called super() with no args (inherited fields undefined). Now a derived
// class with no own constructor gets an implicit `constructor(a0..a5){ super(a0..a5) }` forwarding a fixed
// run of positional args. This fuzzer builds parent/child class pairs (child with no ctor, added methods,
// overrides, multi-level chains) and checks the constructed instance vs Node.
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
    const k = ri(4);
    const a = ri(90), b = ri(90);
    if (k === 0) return `(function(){ class A{ constructor(n){ this.name=n } } class B extends A{} return new B(${a}).name })()`;
    if (k === 1) return `(function(){ class A{ constructor(x,y){ this.s=x+y } } class B extends A{} return new B(${a},${b}).s })()`;
    if (k === 2) return `(function(){ class A{ constructor(v){ this.v=v } dbl(){ return this.v*2 } } class B extends A{ trip(){ return this.v*3 } } let o=new B(${a}); return o.dbl()+"|"+o.trip() })()`;
    return `(function(){ class Base{ constructor(id){ this.id=id } } class Mid extends Base{} class Leaf extends Mid{} return new Leaf(${a}).id })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-implicitctor: ${checked} implicit-constructor programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-implicitctor: " + f); process.exit(1); }
