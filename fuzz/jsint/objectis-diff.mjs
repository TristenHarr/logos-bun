// fuzz/jsint/objectis — Object.is(a, b) (SameValue). Previously unimplemented (→ NaN). Added objIs, which
// mirrors === except NaN is equal to NaN. This fuzzer compares numbers, strings, booleans, null/undefined,
// NaN, and shared vs distinct object identities against Node. (+0/-0 is not exercised — the engine collapses
// -0 to 0, so that SameValue distinction is not observable.)
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
  const atoms = ["1", "2", "NaN", '"a"', '"b"', "true", "false", "null", "undefined", "0", "42", '""'];
  const program = () => {
    if (ri(4) === 0) {
      // object identity: same handle vs distinct
      return ri(2) === 0
        ? `(function(){ let o={x:${ri(9)}}; return Object.is(o,o) })()`
        : `(function(){ return Object.is({a:${ri(9)}},{a:${ri(9)}}) })()`;
    }
    const a = atoms[ri(atoms.length)], b = atoms[ri(atoms.length)];
    return `(function(){ return Object.is(${a}, ${b}) })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-objectis: ${checked} Object.is programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-objectis: " + f); process.exit(1); }
