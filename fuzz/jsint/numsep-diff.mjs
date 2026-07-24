// fuzz/jsint/numsep — numeric-separator underscores in numeric LITERALS (1_000_000, 0xFF_FF,
// 0b1010_1010, 1_000.5, 1_000n) are stripped before parsing, while underscores in identifiers
// (snake_case, a1_b) and inside string literals ("1_000") are preserved. The engine strips '_' only
// inside a digit-started word (identifiers can never begin with a digit), tracking string state so
// quoted content is never touched. Numeric separators inside template ${...} interpolations are a
// known gap and not exercised here. Diffed vs Node.
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
  const grouped = () => { // a decimal integer with random underscore separators between digits
    const digits = String(1 + ri(9)) + Array.from({ length: 3 + ri(4) }, () => String(ri(10))).join("");
    let out = digits[0];
    for (let j = 1; j < digits.length; j++) { if (ri(3) === 0) out += "_"; out += digits[j]; }
    return out;
  };
  const program = () => {
    const k = ri(9);
    if (k === 0) return grouped();
    if (k === 1) return `${grouped()}+${grouped()}`;
    if (k === 2) return `0xF_F`;
    if (k === 3) return `0b10_10`;
    if (k === 4) return `${grouped()}.${5 + ri(4)}`;
    if (k === 5) return `${grouped()}n.toString()`;
    if (k === 6) return `(()=>{let sn_ake=${grouped()};return sn_ake})()`;       // regression: identifier
    if (k === 7) return `"v_${ri(100)}"`;                                          // regression: string underscore
    return `[${grouped()},${grouped()}].length`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-numsep: ${checked} numeric-separator programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-numsep: " + f); process.exit(1); }
