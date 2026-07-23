// fuzz/jsint/copywithin — Array.prototype.copyWithin(target,start,end): copies the [start,end) slice
// onto position target in place (length unchanged, overlap-safe from the original). Was unimplemented.
// Random targets/starts/ends incl. negatives, diffed vs Node.
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
  const lit = () => { const k = 3 + ri(4); return "[" + Array.from({ length: k }, (_, i) => i + 1).join(",") + "]"; };
  const idx = (len) => ri(2) ? ri(len + 1) : -(1 + ri(len));
  const program = () => {
    const a = lit(), len = a.split(",").length, k = ri(3);
    if (k === 0) return `${a}.copyWithin(${idx(len)},${idx(len)}).join(",")`;
    if (k === 1) return `${a}.copyWithin(${idx(len)},${idx(len)},${idx(len)}).join(",")`;
    return `let a=${a};a.copyWithin(${ri(len)},${ri(len)});a.length`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-copywithin: ${checked} copyWithin programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-copywithin: " + f); process.exit(1); }
