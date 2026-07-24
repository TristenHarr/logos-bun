// fuzz/jsint/objkeysarray — Object.keys/values/entries on ARRAY and STRING receivers, plus string-numeric
// array indexing. Object.keys/values/entries only handled plain objects (via objEntrySeq), returning [] for
// arrays/strings; now an array/string is treated as an index-keyed collection: keys → STRING indices
// ["0","1",…] (per spec, unlike arr.keys()'s numbers), values → elements/chars, entries → [stringIndex,
// element] pairs. This exposed a companion bug — `a["0"]`/`a[k]` (string-numeric index) returned undefined
// because the array bracket path fed the tagged index straight to parseInt without materialize; fixed to
// materialize first (matching the object path). Diffed vs Node across keys/values/entries on arrays/strings/
// objects and string-vs-number index access.
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
  const program = () => {
    const arr = `[${Array.from({ length: 1 + ri(5) }, () => ri(100)).join(",")}]`;
    const k = ri(9);
    if (k === 0) return `(function(){return Object.keys(${arr}).join(",")})()`;
    if (k === 1) return `(function(){return Object.values(${arr}).join(",")})()`;
    if (k === 2) return `(function(){return Object.entries(${arr}).map(e=>e.join(":")).join(",")})()`;
    if (k === 3) return `(function(){return Object.keys(${arr})[0]==="0"})()`;                       // string keys
    if (k === 4) { const s = JSON.stringify("s" + ri(999)); return `(function(){return Object.keys(${s}).join(",")+"|"+Object.values(${s}).join(",")})()`; }
    if (k === 5) { const a = `[${Array.from({ length: 2 + ri(4) }, () => ri(100)).join(",")}]`; const idx = ri(2); return `(function(){const a=${a};return a["${idx}"]})()`; }  // string-numeric index
    if (k === 6) { const a = `[${Array.from({ length: 3 }, () => ri(100)).join(",")}]`; return `(function(){const a=${a};const k="${ri(3)}";return a[k]})()`; }              // var string index
    if (k === 7) return `(function(){const a=${arr};let s=0;Object.keys(a).forEach(k=>{s+=a[k]});return s})()`;   // keys→index→accumulate (block body)
    // object regression (must still work)
    return `(function(){const o={a:${ri(50)},b:${ri(50)}};return Object.keys(o).join(",")+"|"+Object.values(o).join(",")})()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-objkeysarray: ${checked} Object.keys/values/entries-on-array + string-index programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-objkeysarray: " + f); process.exit(1); }
