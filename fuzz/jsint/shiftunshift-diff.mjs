// fuzz/jsint/shiftunshift — Array.prototype.shift and unshift, the front-of-array mutators (mirrors of
// pop/push). Both were unimplemented: `a.shift()` returned NaN and didn't remove; `a.unshift(x)` no-op'd.
// arrShift removes+returns the first element (undefined on empty), arrUnshift prepends the items and
// returns the new length, both mutating in place through the heap ref (aliases see it). This fuzzer
// builds a random array, applies a random shift/unshift, and compares the RETURN value and the post-op
// array (via JSON) against Node.
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
    const arr = Array.from({ length: ri(6) }, () => ri(20));
    const k = ri(3);
    if (k === 0) {
      return `(function(){ let a=${JSON.stringify(arr)}; let r=a.shift(); return JSON.stringify(r)+"|"+JSON.stringify(a) })()`;
    }
    if (k === 1) {
      // pop in EXPRESSION position (returns the removed element + mutates)
      return `(function(){ let a=${JSON.stringify(arr)}; let r=a.pop(); return JSON.stringify(r)+"|"+JSON.stringify(a) })()`;
    }
    const items = Array.from({ length: 1 + ri(3) }, () => 90 + ri(9));
    return `(function(){ let a=${JSON.stringify(arr)}; let r=a.unshift(${items.join(",")}); return r+"|"+JSON.stringify(a) })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-shiftunshift: ${checked} shift/unshift programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-shiftunshift: " + f); process.exit(1); }
