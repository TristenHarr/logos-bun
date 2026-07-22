// fuzz/jsint/refclosure-diff — a sync higher-order callback that reads an OUTER heap value by name
// (array index a[i], object d[k], Map m.get(k), Set s.has(x)). Sync HOFs run their callback in the
// enclosing env, so free variables must resolve by NAME at call time — the callback must NOT bake a
// heap-ref free var inline (which yields an inline `<ref>[i]` / `<ref>.get()` that resolves to NaN).
// Regression lock for fnArgValRaw. Output shaped as .join/boolean to dodge the array console.log
// formatting difference. Whole programs via `bun run`, diffed vs Node.
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
const dir = mkdtempSync(join(tmpdir(), "refclo-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const sn = () => 1 + ri(9);
  const program = () => {
    const k = ri(6), a = sn(), b = sn(), c = sn();
    if (k === 0) return `let a=[${a},${b},${c}];console.log([0,1,2].map(i=>a[i]).join(","));`;
    if (k === 1) return `let d={p:${a},q:${b}};console.log(["p","q"].map(k=>d[k]).join(","));`;
    if (k === 2) return `let m=new Map();m.set("x",${a});m.set("y",${b});console.log(["x","y"].map(k=>m.get(k)).join(","));`;
    if (k === 3) return `let s=new Set([${a},${b}]);console.log([${a},${b},${c},99].filter(v=>s.has(v)).join(","));`;
    if (k === 4) return `let lo=${b};console.log([${a},${b},${c},1,9].filter(x=>x>lo).join(","));`;
    return `let f=${a};console.log([1,2,3].map(x=>x*f).join(","));`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src);
    const got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-refclosure: ${checked} outer-ref closures agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-refclosure: " + f); process.exit(1); }
