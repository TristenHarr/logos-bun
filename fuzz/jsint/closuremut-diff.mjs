// fuzz/jsint/closuremut — mutating a free-var OBJECT or ARRAY from inside a callback / IIFE /
// named fn and observing the write in the enclosing scope. Two bugs made this silently no-op:
//   (1) a captured free-var arrived in the callback body as a heap ref TOKEN (substitution), and
//       assignTarget looked it up by envGet (as if it were a variable NAME) → miss → objSet built
//       a fresh non-ref blob and never heapSet the shared object. Fixed by assignRecv (a ref-token
//       base mutates the shared heap object directly).
//   (2) a bare call-statement whose function body contains ` = ` (e.g. `(function(){g.x=5})()` or
//       `arr.forEach(x=>{g.x=1})`) was misread as a top-level assignment (depth-blind ` = ` scan),
//       so the call never ran. Fixed by hasTopSep (depth-aware assignment detection).
// Arrays are pre-sized (no sparse grow), keys are plain (no dotted bracket keys), and no code
// depends on function hoisting — those are separate, still-open gaps this fuzzer deliberately avoids.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const keys = ["a", "b", "c", "d", "e"];
  const nums = () => Array.from({ length: 1 + ri(4) }, () => 1 + ri(9));
  const program = () => {
    const k = ri(8);
    if (k === 0) { // bare IIFE, object dot-assign of a fresh key
      const key = keys[ri(5)], v = ri(20);
      return `(function(){let g={}; (function(){g.${key}=${v}})(); return g.${key}})()`;
    }
    if (k === 1) { // forEach building an object via bracket-assign, count keys
      const ks = keys.slice(0, 1 + ri(5)).map((x) => JSON.stringify(x));
      return `(function(){let g={}; [${ks.join(",")}].forEach(k=>{g[k]=1}); return Object.keys(g).length})()`;
    }
    if (k === 2) { // forEach accumulating a running sum into a free-var object field
      const arr = nums();
      return `(function(){let g={s:0}; [${arr.join(",")}].forEach(x=>{g.s=g.s+x}); return g.s})()`;
    }
    if (k === 3) { // forEach with compound += into a free-var object field
      const arr = nums();
      return `(function(){let g={c:0}; [${arr.join(",")}].forEach(x=>{g.c+=x}); return g.c})()`;
    }
    if (k === 4) { // named fn mutating a free-var object
      const key = keys[ri(5)], v = ri(20);
      return `(function(){let g={${key}:0}; function m(){g.${key}=${v}} m(); return g.${key}})()`;
    }
    if (k === 5) { // forEach writing to a PRE-SIZED array by index
      const arr = nums();
      const zeros = arr.map(() => 0);
      return `(function(){let a=[${zeros.join(",")}]; [${arr.join(",")}].forEach((x,i)=>{a[i]=x*x}); return a.join(",")})()`;
    }
    if (k === 6) { // alias then mutate through the alias inside an IIFE
      const key = keys[ri(5)], v = ri(20);
      return `(function(){let g={${key}:0}; let h=g; (function(){h.${key}=${v}})(); return g.${key}})()`;
    }
    // k === 7: map callback mutating a free-var object as a side effect
    const arr = nums();
    return `(function(){let g={t:0}; [${arr.join(",")}].map(x=>{g.t=g.t+x; return x}); return g.t})()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-closuremut: ${checked} closure-mutation programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-closuremut: " + f); process.exit(1); }
