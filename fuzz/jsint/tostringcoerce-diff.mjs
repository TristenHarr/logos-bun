// fuzz/jsint/tostringcoerce — an object with a user `toString` method used in string coercion. Previously
// `String(obj)`, `""+obj`, a template `${obj}`, and `[obj].join()` all yielded the default `[object Object]`
// instead of calling `toString`. The object→string chokepoint (materialize) now, for a non-Error object,
// invokes a `toString` function-valued slot with `this` bound to the object and returns its result; a plain
// object (no toString) still yields `[object Object]`, and functions are still omitted by JSON.stringify.
// Exercises class instances and object literals, the String()/concat/template/join surfaces, and a toString
// that reads `this`; plain objects, arrays, JSON.stringify, and primitives are re-checked as regressions.
// Diffed vs Node.
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
    const a = ri(50), b = ri(50), k = ri(9);
    if (k === 0) return `(function(){class P{constructor(x){this.x=x}toString(){return "P"+this.x}};return String(new P(${a}))})()`;
    if (k === 1) return `(function(){class P{constructor(x){this.x=x}toString(){return "P"+this.x}};return ""+new P(${a})})()`;
    if (k === 2) return `(function(){class P{constructor(x){this.x=x}toString(){return "P"+this.x}};return \`v=\${new P(${a})}\`})()`;
    if (k === 3) return `(function(){const o={toString(){return "O${a}"}};return String(o)})()`;
    if (k === 4) return `(function(){const o={x:${a},toString(){return "s:"+this.x}};return \`\${o}\`})()`;
    if (k === 5) return `(function(){class P{constructor(x){this.x=x}toString(){return "#"+this.x}};return [new P(${a}),new P(${b})].join("-")})()`;
    if (k === 6) return `(function(){const o={a:${a},b:${b}};return JSON.stringify(o)})()`;     // regression: JSON
    if (k === 7) return `(function(){const o={a:${a}};return String(o)})()`;                    // regression: plain object -> [object Object]
    return `(function(){return String([${a},${b}])})()`;                                        // regression: array/primitive coercion
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-tostringcoerce: ${checked} coercion programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-tostringcoerce: " + f); process.exit(1); }
