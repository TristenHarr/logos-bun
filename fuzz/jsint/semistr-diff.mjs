// fuzz/jsint/semistr — a string VALUE containing a semicolon. The env is a `;`-separated `name=val` list,
// and envSet stored the raw value, so a `;` in it collided with the pair-separator and truncated the value
// on readback: `return "a;b"` yielded "a" (though `"a;b".length` was 3). Fixed by escaping the value's
// semicolons to chr(12) in envSet and restoring them in envScan (a value without `;` round-trips
// unchanged). This fuzzer builds strings sprinkled with semicolons and checks them through return, a
// variable, object/array fields, concatenation, split, and length vs Node.
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
  const mkStr = () => Array.from({ length: 1 + ri(8) }, () => (ri(3) === 0 ? ";" : "abcXY019 "[ri(9)])).join("");
  const program = () => {
    const s = mkStr(), t = mkStr();
    const k = ri(6);
    if (k === 0) return `(function(){ return ${JSON.stringify(s)} })()`;
    if (k === 1) return `(function(){ let v=${JSON.stringify(s)}; return v })()`;
    if (k === 2) return `(function(){ return ${JSON.stringify(s)}.length })()`;
    if (k === 3) return `(function(){ return ${JSON.stringify(s)}.split(";").length })()`;
    if (k === 4) return `(function(){ let o={a:${JSON.stringify(s)},b:${JSON.stringify(t)}}; return o.a+"|"+o.b })()`;
    return `(function(){ return [${JSON.stringify(s)},${JSON.stringify(t)}].join("~") })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-semistr: ${checked} semicolon-in-string programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-semistr: " + f); process.exit(1); }
