// fuzz/jsint/tojson — JSON.stringify honors a user toJSON(): an object carrying a callable toJSON is
// replaced by its toJSON() result before serialization (with `this` bound to the object). Objects
// WITHOUT toJSON (and arrays/strings/numbers) serialize normally — hasUserToJSON returns false for
// them so the common path is unchanged. Exercises toJSON returning a primitive, a string, and a fresh
// object, plus `this`-dependent results and plain-object/array regressions. Top-level only (nested
// toJSON is a known follow-up), so the object under stringify is the sole argument. Diffed vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 300), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = ri(100), b = ri(100), k = ri(7);
    if (k === 0) return `JSON.stringify({toJSON(){return ${a}}})`;
    if (k === 1) return `JSON.stringify({toJSON(){return "s${a}"}})`;
    if (k === 2) return `JSON.stringify({toJSON(){return {v:${a},w:${b}}}})`;
    if (k === 3) return `JSON.stringify({d:${a},toJSON(){return this.d+${b}}})`;
    if (k === 4) return `JSON.stringify({a:${a},b:"${b}"})`;                 // regression: no toJSON
    if (k === 5) return `JSON.stringify([${a},${b},"x"])`;                   // regression: array
    return `(()=>{class P{constructor(){this.n=${a}}toJSON(){return {p:this.n}}};return JSON.stringify(new P())})()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-tojson: ${checked} toJSON programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-tojson: " + f); process.exit(1); }
