// fuzz/jsint/sparsegrow — assigning past the end of an array grows it, filling the gap with
// `undefined` holes (`let a=[5]; a[2]=9` → `[5,,9]`, length 3). arrSetLoop only overwrote existing
// indices, so out-of-bounds assignment was a silent no-op (length/element unchanged). Fixed by
// arrSetIdx → arrGrowSet (re-join existing els, append idx-curLen undefined slots, then the value).
// Also exercises the empty-array + callback combo (forEach building an array from [] by index),
// which needs BOTH the closure-mutation fix and the grow. Node's sparse-hole rendering (join emits
// empty for a hole, length counts it) is the oracle.
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
  const obs = (arr) => ["join(\",\")", "join(\"|\")", "length"][ri(3)]; // what we read back
  const program = () => {
    const k = ri(6);
    if (k === 0) { // grow a non-empty array by writing past the end
      const len = 1 + ri(3), arr = nums(len), idx = len + ri(4), v = ri(50);
      return `(function(){let a=[${arr.join(",")}]; a[${idx}]=${v}; return a.${obs(arr)}})()`;
    }
    if (k === 1) { // grow an EMPTY array
      const idx = ri(5), v = ri(50);
      return `(function(){let a=[]; a[${idx}]=${v}; return a.${obs([])}})()`;
    }
    if (k === 2) { // forEach building an array from [] by index (closure + grow)
      const arr = nums(1 + ri(4));
      return `(function(){let a=[]; [${arr.join(",")}].forEach((x,i)=>{a[i]=x*2}); return a.join(",")})()`;
    }
    if (k === 3) { // several out-of-order out-of-bounds writes
      const v1 = ri(9), v2 = ri(9), v3 = ri(9);
      return `(function(){let a=[${ri(9)}]; a[2]=${v1}; a[4]=${v2}; a[3]=${v3}; return a.join(",")})()`;
    }
    if (k === 4) { // read a specific grown index (hole vs value)
      const idx = 2 + ri(4), v = ri(50), rd = ri(idx + 1);
      return `(function(){let a=[${ri(9)}]; a[${idx}]=${v}; return String(a[${rd}])})()`;
    }
    // k === 5: grow then overwrite an earlier in-bounds slot
    const v1 = ri(50), v2 = ri(50);
    return `(function(){let a=[1,2]; a[4]=${v1}; a[1]=${v2}; return a.join(",")})()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-sparsegrow: ${checked} sparse-grow programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-sparsegrow: " + f); process.exit(1); }
