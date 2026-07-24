// fuzz/jsint/callbackcompound — scalar/member increment/decrement and compound-assignment INSIDE a
// callback body, plus Map/Set forEach accumulation. Two bugs closed: (1) memberCompoundRewrite scanned
// the whole statement with plain hasSep, so a `++`/`+=` inside a callback body (`arr.forEach(x=>{n++})`)
// got mis-rewritten into a bogus top-level assignment because the outer `arr.forEach` looks like a member
// target — guarded now with markerInBody (only a TOP-LEVEL member compound is rewritten); (2) Map.forEach
// / Set.forEach threaded no env write-back, so a scalar accumulator stayed 0 (only object accumulators, as
// shared heap refs, worked) — mapForEachEnv/setForEachEnv now mirror the array forEachEnv write-back. This
// exercises count/accumulate/max idioms with ++, --, += over arrays, Maps, and Sets, diffed vs Node.
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
  const cb = (body) => ri(2) ? `function(x){${body}}` : `x=>{${body}}`;
  const program = () => {
    const vals = Array.from({ length: 2 + ri(5) }, () => ri(20));
    const arr = `[${vals.join(",")}]`;
    const k = ri(10);
    // scalar ++ in an array forEach
    if (k === 0) return `(function(){let n=0;${arr}.forEach(${cb("n++")});return n})()`;
    // scalar -- in an array forEach
    if (k === 1) return `(function(){let n=100;${arr}.forEach(${cb("n--")});return n})()`;
    // conditional ++ (counting)
    if (k === 2) return `(function(){let c=0;${arr}.forEach(${cb("if(x%2===0)c++")});return c})()`;
    // scalar += x
    if (k === 3) return `(function(){let s=0;${arr}.forEach(${cb("s+=x")});return s})()`;
    // object member ++ in a callback
    if (k === 4) return `(function(){const o={c:0};${arr}.forEach(${cb("o.c++")});return o.c})()`;
    // object member += x in a callback
    if (k === 5) return `(function(){const o={s:0};${arr}.forEach(${cb("o.s+=x")});return o.s})()`;
    // Set.forEach scalar accumulation
    if (k === 6) return `(function(){let t=0;const st=new Set(${arr});st.forEach(v=>{t+=v});return t})()`;
    // Set.forEach ++ counter
    if (k === 7) return `(function(){let n=0;const st=new Set(${arr});st.forEach(()=>{n++});return n})()`;
    // Map.forEach scalar accumulation of values
    if (k === 8) { const ent = vals.map((v, i) => `["k${i}",${v}]`).join(","); return `(function(){let s=0;const m=new Map([${ent}]);m.forEach(v=>{s+=v});return s})()`; }
    // top-level member compound must still work (regression guard)
    return `(function(){const o={n:${vals[0]}};o.n++;o.n+=${vals[1] ?? 1};o.n--;return o.n})()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-callbackcompound: ${checked} in-callback inc/dec/compound + Map/Set accumulation programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-callbackcompound: " + f); process.exit(1); }
