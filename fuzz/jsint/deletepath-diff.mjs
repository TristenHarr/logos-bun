// fuzz/jsint/deletepath — `delete` through deep / nested-bracket / mixed access targets: `delete o.x.y`,
// `delete a[0][1]`, `delete o.list[i]`, `delete o.items[i].n`. The old delete handler truncated a dot
// target at the FIRST `.` (deep dot deleted a literal `x . y` key) and a bracket target at the FIRST
// `]` (nested/mixed deleted the wrong slot). Now delete reuses assignTarget's last-top-level-access
// split and removes the slot on the evaluated container ref. Simple `delete o.a` / `delete a[i]` /
// `delete o[k]` are the regression guards. JSON.stringify is the shape oracle.
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
    const k = ri(7);
    if (k === 0) return `(function(){ let o={x:{y:${ri(9)},z:${ri(9)}}}; delete o.x.y; return JSON.stringify(o) })()`;      // deep dot
    if (k === 1) return `(function(){ let a=[[1,2,3]]; delete a[0][${ri(3)}]; return String(a[0].join(",")) })()`;          // nested bracket
    if (k === 2) return `(function(){ let o={list:[10,20,30]}; delete o.list[${ri(3)}]; return String(o.list[${ri(3)}]) })()`; // mixed dot-bracket
    if (k === 3) return `(function(){ let o={items:[{n:${ri(9)},m:${ri(9)}}]}; delete o.items[0].n; return JSON.stringify(o) })()`; // mixed bracket-dot
    if (k === 4) return `(function(){ let o={a:${ri(9)},b:${ri(9)},c:${ri(9)}}; delete o.${["a","b","c"][ri(3)]}; return JSON.stringify(o) })()`; // simple dot (guard)
    if (k === 5) return `(function(){ let o={a:1,b:2}; let key=${JSON.stringify(["a","b"][ri(2)])}; delete o[key]; return JSON.stringify(o) })()`;  // simple bracket (guard)
    // array index (guard) — read the deleted slot + a sibling + length directly. A deleted array slot
    // is a true HOLE in JS but an `undefined` VALUE here, so `.map` (skips holes) and JSON.stringify
    // (hole/undefined → null vs undefined) are deliberately avoided — those are separate documented gaps.
    const di = ri(3);
    return `(function(){ let a=[1,2,3]; delete a[${di}]; return String(a[${di}])+","+String(a[${(di + 1) % 3}])+","+a.length })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-deletepath: ${checked} delete-target programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-deletepath: " + f); process.exit(1); }
