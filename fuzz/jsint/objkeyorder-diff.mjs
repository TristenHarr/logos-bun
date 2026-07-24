// fuzz/jsint/objkeyorder — JS own-property ENUMERATION ORDER: canonical array-index keys first in
// ASCENDING numeric order, then the remaining string keys in insertion order. This governs
// Object.keys/values/entries, for-in, and JSON.stringify. The engine partitions each object's
// entries (isArrayIndexKey: non-empty all-digit, no leading zero, <=9 digits) and insertion-sorts
// the index group by numeric value, leaving string keys in encounter order. A leading-zero key like
// "01" and any non-digit key stay string keys. Diffed vs Node.
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
  const keyPool = ['0', '1', '2', '3', '7', '10', '42', '100', '"a"', '"b"', '"z"', '"name"', '"01"', '"x9"'];
  const objLit = () => {
    const m = 2 + ri(4), used = new Set(), pairs = [];
    for (let j = 0; j < m; j++) {
      let k; let tries = 0;
      do { k = keyPool[ri(keyPool.length)]; tries++; } while (used.has(k) && tries < 12);
      if (used.has(k)) continue;
      used.add(k);
      pairs.push(`${k}:${ri(100)}`);
    }
    return `{${pairs.join(",")}}`;
  };
  const program = () => {
    const o = objLit(), k = ri(5);
    if (k === 0) return `Object.keys(${o}).join(",")`;
    if (k === 1) return `Object.values(${o}).join(",")`;
    if (k === 2) return `Object.entries(${o}).map(e=>e[0]).join(",")`;
    if (k === 3) return `JSON.stringify(${o})`;
    return `(()=>{let s="";for(const k in ${o})s+=k+"|";return s})()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-objkeyorder: ${checked} enumeration-order programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-objkeyorder: " + f); process.exit(1); }
