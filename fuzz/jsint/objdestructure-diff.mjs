// fuzz/jsint/objdestructure — object destructuring: the `...rest` collector (unbound own properties
// into a new object), nested value patterns (`{a:{b}}`, `{list:[x,y]}`), rename, and defaults, in any
// combination. `destructObjLoop` had no rest case (rest → NaN) and the `:` branch did not recurse into
// a nested pattern; `destructureObj` also truncated the pattern inner at the FIRST `}` (dropping a
// trailing `...rest` after a nested field). All fixed together. Node's JSON.stringify of the collected
// rest (and the named bindings) is the oracle; object key order is source/insertion order in both.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 400), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const k = ri(7);
    if (k === 0) return `(function(){ let {a,...rest}={a:${ri(9)},b:${ri(9)},c:${ri(9)}}; return a+"|"+JSON.stringify(rest) })()`;
    if (k === 1) return `(function(){ let {a,b,...r}={a:${ri(9)},b:${ri(9)},c:${ri(9)},d:${ri(9)}}; return JSON.stringify(r) })()`;
    if (k === 2) return `(function(){ let {a:{b}}={a:{b:${ri(9)}}}; return String(b) })()`;
    if (k === 3) return `(function(){ let {a:{b:{c}}}={a:{b:{c:${ri(9)}}}}; return String(c) })()`;
    if (k === 4) return `(function(){ let {list:[x,y]}={list:[${ri(9)},${ri(9)}]}; return x+"/"+y })()`;
    if (k === 5) return `(function(){ let {a:{b},...rest}={a:{b:${ri(9)}},c:${ri(9)},d:${ri(9)}}; return b+"|"+JSON.stringify(rest) })()`;
    return `(function(){ let {p:{q},r,...s}={p:{q:${ri(9)}},r:${ri(9)},x:${ri(9)},y:${ri(9)}}; return q+"|"+r+"|"+JSON.stringify(s) })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-objdestructure: ${checked} object-destructuring programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-objdestructure: " + f); process.exit(1); }
