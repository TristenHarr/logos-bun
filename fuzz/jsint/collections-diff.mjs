// fuzz/jsint/collections-diff — Map and Set (E5). Heap objects with parallel-array storage:
// Map has __map_keys/__map_vals (insertion order, update-in-place, .set/.get/.has/.size), Set has
// __set_vals (dedup on add/construct, .add/.has/.size). Whole programs run through `bun run` and
// diffed (stdout) vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const NODE = process.execPath;
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dir = mkdtempSync(join(tmpdir(), "coll-"));
const runFile = (bin, src) => { const f = join(dir, "c.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const sn = () => 1 + ri(9);
  const key = () => '"' + "abcde"[ri(5)] + '"';
  const program = () => {
    const t = ri(6), a = sn(), b = sn(), k1 = key(), k2 = key();
    if (t === 0) return `let m=new Map();m.set(${k1},${a});m.set(${k2},${b});console.log(m.get(${k1}));`;
    if (t === 1) return `let m=new Map();m.set(${k1},${a});m.set(${k1},${b});console.log(m.get(${k1})+"/"+m.size);`;
    if (t === 2) return `let m=new Map();m.set(${k1},${a});console.log(m.has(${k1})+"/"+m.has(${k2}));`;
    if (t === 3) return `let s=new Set([${a},${b},${a},${sn()}]);console.log(s.size);`;
    if (t === 4) return `let s=new Set();s.add(${a});s.add(${a});s.add(${b});console.log(s.size+"/"+s.has(${a}));`;
    return `let m=new Map();m.set(1,${a});m.set(2,${b});console.log(m.get(1)+m.get(2)+"/"+m.size);`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src);
    const got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-collections: ${checked} Map/Set programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-collections: " + f); process.exit(1); }
