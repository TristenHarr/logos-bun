// fuzz/jsint/splice — Array.prototype.splice: the in-place mutator `a.splice(start, deleteCount,
// ...items)` was entirely unimplemented (`.splice(` wasn't in the method table, so it no-op'd and the
// array was unchanged). Now arrSplice removes deleteCount elements at a normalized start (negative
// counts from the end, an omitted deleteCount removes to the end), splices the items in, MUTATES the
// array in place through its heap ref (so aliases see it), and returns a new array of the removed
// elements. This fuzzer builds a random array, applies a random splice, and compares BOTH the returned
// removed-array and the post-splice array (via JSON) against Node.
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
    const len = ri(6);
    const arr = Array.from({ length: len }, () => ri(20));
    const start = ri(3) === 0 ? -(1 + ri(len + 1)) : ri(len + 2);
    const argc = ri(4); // 0: splice(start) ; 1: splice(start,dc) ; 2+: with items
    const dc = ri(len + 2);
    const items = Array.from({ length: Math.max(0, argc - 1) }, () => 90 + ri(9));
    const call = argc === 0
      ? `a.splice(${start})`
      : `a.splice(${start},${dc}${items.length ? "," + items.join(",") : ""})`;
    return `(function(){ let a=${JSON.stringify(arr)}; let r=${call}; return JSON.stringify(r)+"|"+JSON.stringify(a) })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-splice: ${checked} splice programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-splice: " + f); process.exit(1); }
