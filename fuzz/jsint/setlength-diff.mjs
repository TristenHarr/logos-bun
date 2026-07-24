// fuzz/jsint/setlength — assigning to `arr.length`. assignDot treated `length` as an ordinary object
// property (objSet on the array handle), so `a.length = 1` corrupted the array instead of truncating it.
// Added arrSetLength (n<cur truncates, n>cur extends with undefined holes, n<=0 empties) hooked into
// assignDot when the receiver is an array — objects keep a plain `length` property. This fuzzer sets
// .length above/below/at the current length and checks join, length, element access, and alias sharing.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 300), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const len = 1 + ri(6);
    const arr = `[${Array.from({ length: len }, () => ri(20)).join(",")}]`;
    const nl = ri(9); // target length 0..8
    const k = ri(5);
    if (k === 0) return `(function(){ let a=${arr}; a.length=${nl}; return a.join(",") })()`;
    if (k === 1) return `(function(){ let a=${arr}; a.length=${nl}; return a.length })()`;
    if (k === 2) return `(function(){ let a=${arr}; let b=a; a.length=${nl}; return b.length+"|"+b.join(",") })()`;
    if (k === 3) return `(function(){ let a=${arr}; a.length=${nl}; a.push(99); return a.join(",") })()`;
    return `(function(){ let a=${arr}; a.length=${nl}; return String(a[${ri(9)}]) })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-setlength: ${checked} arr.length-assignment programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-setlength: " + f); process.exit(1); }
