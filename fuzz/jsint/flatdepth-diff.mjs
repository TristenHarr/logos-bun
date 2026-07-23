// fuzz/jsint/flatdepth — Array.prototype.flat(depth): flatten `depth` levels (default 1, Infinity =
// all). The dispatch ignored the depth argument (always one level), so flat(2)/flat(Infinity)/flat(0)
// were wrong. Random nested arrays flattened at random depths, diffed vs Node.
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
  const nested = (d) => { if (d <= 0 || ri(2)) return String(ri(9)); return "[" + Array.from({ length: 1 + ri(2) }, () => nested(d - 1)).join(",") + "]"; };
  const topArr = () => "[" + Array.from({ length: 1 + ri(3) }, () => nested(3)).join(",") + "]";
  const depth = () => ["", "0", "1", "2", "3", "Infinity"][ri(6)];
  const program = () => {
    const a = topArr(), d = depth(), k = ri(2);
    if (k === 0) return `${a}.flat(${d}).length`;
    return `${a}.flat(${d}).join(",")`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-flatdepth: ${checked} flat programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-flatdepth: " + f); process.exit(1); }
