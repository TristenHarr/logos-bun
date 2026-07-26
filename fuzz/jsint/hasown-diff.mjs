// fuzz/jsint/hasown — Object.hasOwn(obj,key) (ES2022 static) and obj.hasOwnProperty(key). Object.hasOwn
// had NO handler and stack-overflowed (crash); now both route through a shared hasOwnKey: a plain object
// owns a key iff it's a stored property, an array owns "length" and each canonical integer index 0..len-1
// (non-canonical "1.5"/"-1"/"01" or out-of-range → not own). Diffed vs Node (`bun run`).
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dir = OURS ? mkdtempSync(join(tmpdir(), "how-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const objKeys = ["a", "b", "name", "id", "x"];
  const probeKeys = ["a", "b", "z", "name", "0", "1", "2", "5", "length", "1.5", "-1", "01", "id"];
  const objLit = () => { const m = 1 + ri(3); const seen = new Set(); const parts = []; for (let i = 0; i < m; i++) { let k = objKeys[ri(objKeys.length)]; while (seen.has(k)) k = objKeys[ri(objKeys.length)]; seen.add(k); parts.push(`${k}:${ri(9)}`); } return "{" + parts.join(",") + "}"; };
  const arrLit = () => "[" + Array.from({ length: ri(4) }, () => ri(9)).join(",") + "]";
  const program = () => {
    const key = JSON.stringify(probeKeys[ri(probeKeys.length)]);
    const k = ri(6);
    if (k === 0) return `console.log(Object.hasOwn(${objLit()},${key}))`;
    if (k === 1) return `console.log(Object.hasOwn(${arrLit()},${key}))`;
    if (k === 2) return `const o=${objLit()};console.log(o.hasOwnProperty(${key}))`;
    if (k === 3) return `const a=${arrLit()};console.log(a.hasOwnProperty(${key}))`;
    if (k === 4) return `const o=${objLit()};console.log(Object.hasOwn(o,${key})?"y":"n")`;
    return `console.log([Object.hasOwn(${objLit()},${key}),Object.hasOwn(${arrLit()},${key})].join(","))`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    const ref = runFile("node", p);
    const got = runFile(OURS, p);
    if (got !== ref) fails.push(`run(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  rmSync(dir, { recursive: true, force: true });
  if (!fails.length) console.log(`PASS jsint-hasown: ${checked} hasOwn/hasOwnProperty programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-hasown: " + f); process.exit(1); }
