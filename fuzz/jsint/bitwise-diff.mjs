// fuzz/jsint/bitwise-diff — JS bitwise operators (E5): & | ^ ~ << >> >>>. Operands coerce to
// 32-bit signed ints (native js_b* ops); precedence tiers slot between && and comparison
// (| < ^ < &, then shifts). Covers each op, mixed precedence, and chains, diffed vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ours = (e) => { const r = spawnSync(OURS, ["__js", e], { encoding: "utf8" }); return r.status !== 0 ? `ERR:${r.status}` : (r.stdout || "").replace(/\n$/, ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 2000), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const v = () => ri(64);
  const sh = () => 1 + ri(6);
  const expr = () => {
    const t = ri(9);
    if (t === 0) return `${v()}&${v()}`;
    if (t === 1) return `${v()}|${v()}`;
    if (t === 2) return `${v()}^${v()}`;
    if (t === 3) return `~${v()}`;
    if (t === 4) return `${v()}<<${sh()}`;
    if (t === 5) return `${v()}>>${sh()}`;
    if (t === 6) return `${v()}&${v()}|${v()}`;     // & before |
    if (t === 7) return `${v()}^${v()}&${v()}`;     // & before ^
    return `${v()}>>>${sh()}`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const e = expr();
    let ref; try { ref = String(eval(e)); } catch { continue; }
    const got = ours(e);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(e)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-bitwise: ${checked} bitwise expressions agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-bitwise: " + f); process.exit(1); }
