// fuzz/jsint/isfrozen — Object.isFrozen now reports correctly: a primitive is always frozen; an object
// or array is frozen iff Object.freeze marked it (a hidden __frozen flag, filtered from Object.keys/
// values/entries and JSON.stringify). Object.freeze returns the SAME reference. NOTE: immutability is
// not yet ENFORCED (a write to a frozen object still mutates) — only the isFrozen REPORT and the marker
// hiding are exercised here. Diffed vs Node.
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
  const prim = () => [`${ri(100)}`, `"s${ri(9)}"`, `true`, `null`, `undefined`][ri(5)];
  const program = () => {
    const a = ri(50), b = ri(50), k = ri(8);
    if (k === 0) return `Object.isFrozen(Object.freeze({a:${a},b:${b}}))`;
    if (k === 1) return `Object.isFrozen({a:${a}})`;                         // unfrozen object -> false
    if (k === 2) return `Object.isFrozen(${prim()})`;                       // primitive -> true
    if (k === 3) return `Object.isFrozen([${a},${b}])`;                     // unfrozen array -> false
    if (k === 4) return `JSON.stringify(Object.freeze({x:${a},y:${b}}))`;   // marker must not leak
    if (k === 5) return `Object.keys(Object.freeze({p:${a},q:${b}})).join(",")`;
    if (k === 6) return `(()=>{const o=Object.freeze({n:${a}});return o.n+${b}})()`;   // read a frozen prop
    return `Object.isFrozen(Object.freeze({${a}:"x",${b + 100}:"y"}))`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-isfrozen: ${checked} Object.isFrozen programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-isfrozen: " + f); process.exit(1); }
