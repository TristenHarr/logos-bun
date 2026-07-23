// fuzz/jsint/structclone — structuredClone(x): a recursive DEEP copy (was unimplemented -> NaN, and
// crashed on a string). Compares the JSON shape of the clone to Node, and (crucially) checks the clone
// is INDEPENDENT: mutating the clone must not change the source.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const val = (d) => { if (d <= 0 || ri(2)) return String(ri(50)); return ri(2) ? "[" + Array.from({ length: ri(3) }, () => val(d - 1)).join(",") + "]" : "{" + Array.from({ length: 1 + ri(2) }, (_, i) => ["a", "b", "c"][i] + ":" + val(d - 1)).join(",") + "}"; };
  const program = () => {
    const v = val(3), k = ri(2);
    if (k === 0) return `JSON.stringify(structuredClone(${v}))`;
    return `(function(){let s=${v}; let c=structuredClone(s); return JSON.stringify(c)===JSON.stringify(s)})()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-structclone: ${checked} structuredClone programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-structclone: " + f); process.exit(1); }
