// fuzz/jsint/dottedcb — a bare reference to a one-argument built-in METHOD used as an array callback:
// arr.map(Math.sqrt), arr.filter(Number.isInteger), arr.every(Number.isInteger). Only bare global fns
// (Number/String) rode the callback path (synthGlobalCb); a dotted Math.x/Number.x fell to jsEvalIn and
// evaluated to garbage. isDottedBuiltinFn now recognises a three-token Math./Number. reference and wraps
// it the same way. Arrow/user-fn/bare-global callbacks are regressions. Diffed vs Node.
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
  const ints = () => Array.from({ length: 2 + ri(4) }, () => 1 + ri(30));
  const flts = () => Array.from({ length: 2 + ri(4) }, () => (1 + ri(30)) + ri(10) / 10);
  const program = () => {
    const k = ri(8);
    if (k === 0) return `[${flts()}].map(Math.floor).join(",")`;
    if (k === 1) return `[${flts()}].map(Math.round).join(",")`;
    if (k === 2) return `[${ints().map(x => x * x)}].map(Math.sqrt).join(",")`;
    if (k === 3) return `[${ints().map(x => -x)}].map(Math.abs).join(",")`;
    if (k === 4) return `[${ints()}].every(Number.isInteger)?"t":"f"`;
    if (k === 5) return `[${flts()}].filter(Number.isInteger).length`;
    if (k === 6) return `[${ints()}].map(String).join(",")`;             // regression: bare global
    return `[${ints()}].map(x=>x*2).join(",")`;                          // regression: arrow
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-dottedcb: ${checked} dotted-builtin-callback programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-dottedcb: " + f); process.exit(1); }
