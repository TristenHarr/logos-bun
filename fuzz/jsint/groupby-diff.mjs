// fuzz/jsint/groupby — Object.groupBy(items, fn) / Map.groupBy(items, fn) (ES2024). Both were undefined
// statics that stack-overflowed (crash); now they partition items into groups keyed by fn(item,index),
// preserving encounter order — Object.groupBy coerces the key to a property string and returns an object
// of arrays; Map.groupBy keeps the value key and returns a Map. Object result compared via
// JSON.stringify; Map via a sorted key/values dump. Diffed vs Node (`bun run`).
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "gb-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const ints = () => "[" + Array.from({ length: ri(8) }, () => ri(12)).join(",") + "]";
  const strs = () => "[" + Array.from({ length: 1 + ri(6) }, () => JSON.stringify(["cat", "dog", "fox", "owl"][ri(4)])).join(",") + "]";
  const program = () => {
    const k = ri(7);
    if (k === 0) return `console.log(JSON.stringify(Object.groupBy(${ints()},x=>x%2?"odd":"even")))`;
    if (k === 1) return `console.log(JSON.stringify(Object.groupBy(${ints()},x=>x>5?"big":"small")))`;
    if (k === 2) return `console.log(JSON.stringify(Object.groupBy(${strs()},s=>s[0])))`;
    if (k === 3) return `console.log(JSON.stringify(Object.groupBy(${ints()},(x,i)=>i%2?"b":"a")))`;
    if (k === 4) { return `const m=Map.groupBy(${ints()},x=>x%3);let out=[];for(const key of [0,1,2]){const v=m.get(key);out.push(key+":"+(v?v.join(","):""))}console.log(out.join("|"))`; }
    if (k === 5) { return `const m=Map.groupBy(${ints()},x=>x%2===0);console.log("t="+(m.get(true)||[]).join(",")+" f="+(m.get(false)||[]).join(","))`; }
    return `console.log(JSON.stringify(Object.groupBy(${ints()},x=>String(x%4))))`;
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
  if (!fails.length) console.log(`PASS jsint-groupby: ${checked} groupBy programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-groupby: " + f); process.exit(1); }
