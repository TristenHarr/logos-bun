// fuzz/jsint/bracketkey — assignment to a computed bracket target whose KEY expression itself
// contains a `.` (member access) or method call: `a[a.length-1]=v`, `o[k.toString()]=v`. The key's
// nested `.` tripped assignTarget's entry guard `hasSep(target," . ")`, routing the whole statement
// to the dot-assign path (base parsed as `a [ a`) so the write was lost. Fixed by making that guard
// depth-aware (hasTopSep) — a `.` inside `[...]` no longer counts as a top-level member assignment.
// Arrays are pre-sized (in-bounds indices only — sparse grow is a separate open gap).
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
  const nums = (len) => Array.from({ length: len }, () => 1 + ri(9));
  const program = () => {
    const k = ri(6);
    if (k === 0) { // last-element write via a.length-1 key
      const len = 2 + ri(4), arr = nums(len), v = ri(50);
      return `(function(){let a=[${arr.join(",")}]; a[a.length-1]=${v}; return a.join(",")})()`;
    }
    if (k === 1) { // arbitrary in-bounds index via arithmetic key
      const len = 2 + ri(4), arr = nums(len), idx = ri(len), v = ri(50);
      return `(function(){let a=[${arr.join(",")}]; a[${idx}+0]=${v}; return a[${idx}]})()`;
    }
    if (k === 2) { // object computed key via a method call on a string var
      const key = ["a", "b", "c"][ri(3)], v = ri(50);
      return `(function(){let o={a:0,b:0,c:0}; let s=${JSON.stringify(key.toUpperCase())}; o[s.toLowerCase()]=${v}; return o.${key}})()`;
    }
    if (k === 3) { // object computed key via string concat
      const key = ["k", "m", "z"][ri(3)], v = ri(50);
      return `(function(){let o={}; o[${JSON.stringify(key)}+""]=${v}; return o.${key}})()`;
    }
    if (k === 4) { // for-loop filling a pre-sized array by index
      const len = 2 + ri(4);
      return `(function(){let a=[${nums(len).map(() => 0).join(",")}]; for(let i=0;i<${len};i++){a[i]=i*i} return a.join(",")})()`;
    }
    // k === 5: nested-key read used as write index (a[a[0]] style), fully in bounds
    const v = ri(50);
    return `(function(){let a=[1,2,0,0]; a[a[0]+1]=${v}; return a.join(",")})()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-bracketkey: ${checked} computed-key assignments agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-bracketkey: " + f); process.exit(1); }
