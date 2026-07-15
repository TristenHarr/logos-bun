// fuzz/jsint/concat-diff — array .concat (merge, dispatched by receiver tag) and
// the global Array.isArray type predicate, over random arrays/strings/numbers,
// each run through logos-bun __js AND Node eval and required to agree.
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
const nodeRun = (p) => { const parts = p.split(";"); const body = parts.slice(0, -1).map((s) => s + ";").join("") + " return (" + parts[parts.length - 1] + ");"; return eval("(()=>{" + body + "})()"); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const sn = () => 1 + ri(9);
  const lit = () => "[" + Array.from({ length: 1 + ri(4) }, () => sn()).join(",") + "]";
  const program = () => {
    const k = ri(7);
    if (k === 0) return `let a=${lit()};let b=${lit()};a.concat(b).join(",")`;
    if (k === 1) return `${lit()}.concat(${lit()}).length`;
    if (k === 2) return `let a=${lit()};a.concat(${lit()}).map(x=>x+1).join("-")`;
    if (k === 3) { const w1 = "ab", w2 = "cd"; return `"${w1}".concat("${w2}")`; }
    if (k === 4) return `Array.isArray(${lit()})`;
    if (k === 5) return `Array.isArray(${sn()})`;
    return `let a=${lit()};Array.isArray(a)`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = nodeRun(p); } catch { continue; }
    ref = String(ref);
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-concat: ${checked} concat/isArray programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-concat: " + f); process.exit(1); }
