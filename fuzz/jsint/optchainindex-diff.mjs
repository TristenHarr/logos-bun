// fuzz/jsint/optchainindex — optional chaining with a COMPUTED / bracket index: `o?.[k]`, `a?.[i]`.
// resolveOptChain rewrote `?.` to `.` for every tail, producing the invalid `o . [k]`; it now
// JUXTAPOSES an index (`o [k]`) or call tail, and runs before resolveArrays so the index isn't mangled
// first. A nullish receiver consumes the balanced index group and short-circuits to undefined (then a
// trailing `?? d` yields d). The ubiquitous `path.split(".").reduce((o,k)=>o?.[k], obj)` deep-get works.
// (Chained optional index `o?.[a]?.[b]` and optional call `o?.m()` remain a separate open gap.)
// Diffed vs Node via a module file.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dir = OURS ? mkdtempSync(join(tmpdir(), "oci-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 100), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const keys = ["a", "b", "x", "y", "k"];
  const program = () => {
    const key = keys[ri(keys.length)], v = ri(50), idx = ri(3), k = ri(6);
    if (k === 0) return `let o={${key}:${v}};let key=${JSON.stringify(key)};console.log(o?.[key])`;
    if (k === 1) return `let a=[${v},${v + 1},${v + 2}];let i=${idx};console.log(a?.[i])`;
    if (k === 2) return `let o=null;let key=${JSON.stringify(key)};console.log(o?.[key]??"def")`;
    if (k === 3) return `let m={${key}:${v}};console.log(m?.[${JSON.stringify(key)}]??0)`;
    if (k === 4) return `const deepGet=(obj,path)=>path.split(".").reduce((o,k)=>o?.[k],obj);console.log(deepGet({a:{b:{c:${v}}}},"a.b.c"))`;
    return `let o={${key}:${v}};console.log(o?.${key})`;                                    // regression: optional DOT
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    const ref = runFile("node", p);
    const got = runFile(OURS, p);
    if (got !== ref) fails.push(`run(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  rmSync(dir, { recursive: true, force: true });
  if (!fails.length) console.log(`PASS jsint-optchainindex: ${checked} optional-index programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-optchainindex: " + f); process.exit(1); }
