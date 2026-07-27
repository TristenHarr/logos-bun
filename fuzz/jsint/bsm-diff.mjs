// fuzz/jsint/bsm — builtin static methods as FIRST-CLASS VALUES. A reference like Object.keys or
// Array.isArray that is not immediately called is a function value: it can be aliased to a variable and
// invoked later, passed as a callback, or asked its typeof (=== "function"). test262's propertyHelper.js
// aliases four of them at load, so this underpins its whole verify* family. Diffed vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const NODE = "node";
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const run = (bin, dir, args) => { const r = spawnSync(bin, args, { encoding: "utf8", cwd: dir, timeout: 5000 }); return ((r.stdout || "") + (r.status ? "\n<exit:" + r.status + ">" : "")).trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = 1 + ri(20), b = 1 + ri(20), k = ri(10);
    if (k === 0) return `var k = Object.keys;\nconsole.log(k({ x: ${a}, y: ${b} }).join(","));`;
    if (k === 1) return `var m = Math.max;\nconsole.log(m(${a}, ${b}, ${a + b}));`;
    if (k === 2) return `var isArr = Array.isArray;\nconsole.log(isArr([${a}]), isArr(${b}));`;
    if (k === 3) return `var d = Object.getOwnPropertyDescriptor;\nvar o = { p: ${a} };\nconsole.log(d(o, "p").value, d(o, "p").enumerable);`;
    if (k === 4) return `var dp = Object.defineProperty;\nvar o = {};\ndp(o, "z", { value: ${a}, enumerable: true });\nconsole.log(o.z);`;
    if (k === 5) return `var g = Object.getOwnPropertyNames;\nconsole.log(g({ a: ${a}, b: ${b} }).length);`;
    if (k === 6) return `console.log(typeof Math.floor, typeof Object.keys, typeof Array.isArray);`;
    if (k === 7) return `var f = Math.floor;\nvar vals = [${a}.5, ${b}.9];\nconsole.log(vals.map(f).join(","));`;
    if (k === 8) return `var v = Object.values;\nconsole.log(v({ a: ${a}, b: ${b} }).join("+"));`;
    return `var mn = Math.min, mx = Math.max;\nconsole.log(mn(${a}, ${b}), mx(${a}, ${b}));`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "bsmf-"));
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-bsm: ${checked} builtin-static-value programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-bsm: " + f); process.exit(1); }
