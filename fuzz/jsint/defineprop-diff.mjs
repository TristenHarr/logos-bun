// fuzz/jsint/defineprop — Object.defineProperty with data AND accessor descriptors. A `{value}` descriptor
// writes the property; a `{get}` / `{get, set}` descriptor installs an accessor (stored in the engine's
// __get_/__set_ slots, so a read invokes the getter with `this` bound and a write invokes the setter).
// enumerable data props show in Object.keys. Diffed vs Node.
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
    const a = 1 + ri(20), b = 1 + ri(20), k = ri(9);
    // NOTE: non-enumerable tracking (a prop defined without `enumerable:true` hidden from Object.keys) is a
    // deferred gap — objects don't track per-property writable/enumerable/configurable yet.
    if (k === 7) return `var o = {}; o["p${a}"] = ${b};\nconsole.log(o.propertyIsEnumerable("p${a}"), o.propertyIsEnumerable("q${a}"));`;
    if (k === 8) return `var o = { a: ${a}, b: ${b} };\nconsole.log(o.propertyIsEnumerable("a"), o.hasOwnProperty("b"), o.propertyIsEnumerable("toString"));`;
    if (k === 0) return `var o = {};\nObject.defineProperty(o, "x", { value: ${a} });\nconsole.log(o.x);`;
    if (k === 1) return `var o = {};\nObject.defineProperty(o, "g", { get: function(){ return ${a}; } });\nconsole.log(o.g);`;
    if (k === 2) return `var o = { n: ${a} };\nObject.defineProperty(o, "v", { get: function(){ return this.n + 1; }, set: function(x){ this.n = x; } });\no.v = ${b};\nconsole.log(o.v, o.n);`;
    if (k === 3) return `var o = {};\nObject.defineProperty(o, "a", { value: ${a} });\nObject.defineProperty(o, "b", { get: function(){ return this.a * 3; } });\nconsole.log(o.a, o.b);`;
    if (k === 4) return `var o = {};\nObject.defineProperty(o, "c", { get: function(){ return ${a} * 2; } });\nconsole.log(o.c + ${b});`;
    if (k === 5) return `function make(){ var o = {}; Object.defineProperty(o, "id", { get: function(){ return ${a}; } }); return o; }\nconsole.log(make().id);`;
    return `var o = { _x: ${a} };\nObject.defineProperty(o, "x", { get: function(){ return this._x; }, set: function(v){ this._x = v * 2; } });\no.x = ${b};\nconsole.log(o.x);`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "dpf-"));
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-defineprop: ${checked} Object.defineProperty programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-defineprop: " + f); process.exit(1); }
