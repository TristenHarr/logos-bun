// fuzz/jsint/uncurry — the uncurry-`this` idiom `Function.prototype.call.bind(X.prototype.method)`, which
// yields a function whose FIRST argument becomes the receiver: G(a, b) === a.method(b). propertyHelper.js
// (included by nearly every property-descriptor test262 test) is built entirely on it — __join, __push,
// __hasOwnProperty, __propertyIsEnumerable. Also covers the same idiom bound over a user closure
// (fn.call(a, b) = fn with this=a). Diffed vs Node.
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
    const a = 1 + ri(20), b = 1 + ri(20), k = ri(8);
    if (k === 0) return `var j = Function.prototype.call.bind(Array.prototype.join);\nconsole.log(j([${a},${b}], "-"));`;
    if (k === 1) return `var p = Function.prototype.call.bind(Array.prototype.push);\nvar arr = [${a}];\np(arr, ${b});\nconsole.log(arr.join(","));`;
    if (k === 2) return `var h = Function.prototype.call.bind(Object.prototype.hasOwnProperty);\nvar o = {}; o["k${a}"] = 1;\nconsole.log(h(o, "k${a}"), h(o, "z${b}"));`;
    if (k === 3) return `var s = Function.prototype.call.bind(String.prototype.slice);\nconsole.log(s("hello${a}", 0, 3));`;
    if (k === 4) return `var idx = Function.prototype.call.bind(Array.prototype.indexOf);\nconsole.log(idx([${a},${b},${a}], ${b}));`;
    if (k === 5) return `var f = function(x){ return this.base + x; };\nvar g = Function.prototype.call.bind(f);\nconsole.log(g({base:${a}}, ${b}));`;
    if (k === 6) return `var tc = Function.prototype.call.bind(Array.prototype.concat);\nconsole.log(tc([${a}], ${b}, ${a}).join(","));`;
    return `var up = Function.prototype.call.bind(String.prototype.toUpperCase);\nconsole.log(up("ab${a}"));`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "ucf-"));
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-uncurry: ${checked} uncurry-this programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-uncurry: " + f); process.exit(1); }
