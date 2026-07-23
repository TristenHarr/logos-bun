// fuzz/jsint/staticfield — static class FIELDS: `class C { static x = 5 }` then `C.x` (read) and
// same-scope `C.x = …` (write). The desugar treated `static x = v` as a method (garbage), and even
// once bound, `C.x` didn't resolve. Fixed: a static-field branch in classWalk binds `__static_C_x = v`,
// resolveStaticProps resolves the READ before substitute, and the `=` dispatch rewrites `C.x = v` to
// the `__static_` binding. Static methods and instance access/assignment are the regression guards.
// (A static field mutated from INSIDE a method is a separate scalar-write-back limitation, avoided.)
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
    if (k === 0) { const v = ri(99); return `(function(){ class C{static x=${v}} return C.x })()`; }
    if (k === 1) { const a = ri(50), b = ri(50); return `(function(){ class C{static a=${a}; static b=${b}} return C.a+C.b })()`; }
    if (k === 2) { const s = ri(9); return `(function(){ class C{static count=${s}} C.count=C.count+3; C.count=C.count+4; return C.count })()`; }
    if (k === 3) { const v = ri(50), w = ri(50); return `(function(){ class C{static v=${v}} C.v=${w}; return C.v })()`; }
    if (k === 4) { const v = ri(50); return `(function(){ class C{static base=${v}; static twice(){return C.base*2}} return C.twice() })()`; }  // static method reads static field
    // k === 5: REGRESSION — static method + instance access mixed
    const v = ri(50);
    return `(function(){ class C{static make(x){return new C(x)} constructor(x){this.x=x}} return C.make(${v}).x })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-staticfield: ${checked} static-field programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-staticfield: " + f); process.exit(1); }
