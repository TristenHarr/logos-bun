// fuzz/jsint/mixedassign — assignment targets that MIX dot and bracket access: `a[i].b=v`,
// `o.list[i]=v`, `o.a.b[i]=v`, `a[i][j]=v`, `o.items[i].n=v`. assignTarget used to handle only a pure
// dot chain (objSetPath) or a single leading bracket, so every mixed path silently no-op'd. Fixed by
// splitting the target at its LAST top-level access operator and writing onto the evaluated container
// ref (heapSet in place). Pure dot / single bracket are the regression guards.
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
    const k = ri(8);
    if (k === 0) { // bracket-then-dot: a[i].b = v
      const i = ri(2), v = ri(50);
      return `(function(){ let a=[{b:1},{b:2}]; a[${i}].b=${v}; return a[${i}].b })()`;
    }
    if (k === 1) { // dot-then-bracket: o.list[i] = v
      const i = ri(3), v = ri(50);
      return `(function(){ let o={list:[10,20,30]}; o.list[${i}]=${v}; return o.list[${i}] })()`;
    }
    if (k === 2) { // deep dot then bracket: o.a.b[i] = v
      const i = ri(2), v = ri(50);
      return `(function(){ let o={a:{b:[1,2]}}; o.a.b[${i}]=${v}; return o.a.b[${i}] })()`;
    }
    if (k === 3) { // nested arrays: a[i][j] = v
      const i = ri(2), j = ri(2), v = ri(50);
      return `(function(){ let a=[[1,2],[3,4]]; a[${i}][${j}]=${v}; return a[${i}][${j}] })()`;
    }
    if (k === 4) { // array of objects, prop write, sum read
      const i = ri(3), v = ri(50);
      return `(function(){ let a=[{n:0},{n:0},{n:0}]; a[${i}].n=${v}; return a[0].n+a[1].n+a[2].n })()`;
    }
    if (k === 5) { // computed index into a mixed path
      const v = ri(50);
      return `(function(){ let o={xs:[0,0,0]}; let i=1; o.xs[i+1]=${v}; return o.xs.join(",") })()`;
    }
    if (k === 6) { // REGRESSION: pure dot chain
      const v = ri(50);
      return `(function(){ let o={a:{b:{c:1}}}; o.a.b.c=${v}; return o.a.b.c })()`;
    }
    // k === 7: REGRESSION: single bracket + object bracket-key
    const v = ri(50);
    return `(function(){ let a=[1,2,3]; a[2]=${v}; let o={}; o["k"]=${v}; return a[2]+o.k })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-mixedassign: ${checked} mixed-access assignments agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-mixedassign: " + f); process.exit(1); }
