// fuzz/jsint/replacefngroups — the .replace(re, fn) callback receiving capture groups: (match, p1, …, pN,
// offset, string). reReplaceFnLoop passed only (match, offset) via callFnIdx, so a callback using its group
// params saw undefined. Added callReplaceFn, which binds [match, ...groups, offset, string] positionally
// from capExtract. This fuzzer builds replaces whose callbacks reorder/transform capture groups vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const word = () => "abcdef".slice(0, 1 + ri(4));
  const num = () => String(1 + ri(90));
  const program = () => {
    const k = ri(4);
    if (k === 0) return `(function(){ return "${word()}${num()}".replace(/([a-z]+)(\\d+)/,(m,a,b)=>b+":"+a) })()`;
    if (k === 1) return `(function(){ return "${word()} ${word()}".replace(/(\\w+) (\\w+)/,(m,a,b)=>b+","+a) })()`;
    if (k === 2) return `(function(){ return "${word()}".replace(/(\\w)/g,(m,c)=>c.toUpperCase()) })()`;
    return `(function(){ return "${num()}-${num()}".replace(/(\\d+)-(\\d+)/g,(m,a,b)=>String(Number(a)+Number(b))) })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-replacefngroups: ${checked} replace-fn-groups programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-replacefngroups: " + f); process.exit(1); }
