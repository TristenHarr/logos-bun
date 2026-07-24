// fuzz/jsint/indexofnan — the NaN split between indexOf/lastIndexOf (strict === → NaN never matches) and
// includes (SameValueZero → NaN matches). indexOf compared stored representations, so a bare-`NaN` element
// wrongly matched a NaN target; excluding that broke includes (which was indexOf(x)!==-1). Now indexOf/
// lastIndexOf skip a NaN match and includes has its own SameValueZero scan. This fuzzer builds arrays that
// may contain NaN and searches them with all three methods (plus a string-includes regression) vs Node.
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
  const el = () => (ri(4) === 0 ? "NaN" : String(ri(5)));
  const program = () => {
    const arr = `[${Array.from({ length: 1 + ri(6) }, el).join(",")}]`;
    const target = ri(3) === 0 ? "NaN" : String(ri(5));
    const m = ri(4);
    if (m === 0) return `(function(){ return ${arr}.indexOf(${target}) })()`;
    if (m === 1) return `(function(){ return ${arr}.lastIndexOf(${target}) })()`;
    if (m === 2) return `(function(){ return ${arr}.includes(${target}) })()`;
    const s = JSON.stringify("ab" + ri(9) + "cd");
    const sub = JSON.stringify(ri(2) ? "b" + ri(9) : "zz");
    return `(function(){ return ${s}.includes(${sub}) })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-indexofnan: ${checked} indexOf/includes-NaN programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-indexofnan: " + f); process.exit(1); }
