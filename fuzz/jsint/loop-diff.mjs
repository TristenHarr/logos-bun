// fuzz/jsint/loop-diff — the P7 JS engine running CONTROL FLOW: while loops with
// assignment (iteration + mutation = Turing-complete), differential-fuzzed vs
// Node eval. Generates terminating accumulator loops (let acc/i ; while (i<=N) {
// acc = acc OP i ; i = i + 1 } ; acc) — the shapes real algorithms (sum,
// factorial, powers) are built from. Bounded N so loops finish + stay i64-exact.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const run = (p) => { const r = spawnSync(OURS, ["__js-run", p], { encoding: "utf8" }); return r.status !== 0 ? `ERR:${r.status}` : (r.stdout || "").replace(/\n$/, ""); };
const nodeRun = (p) => { const parts = p.split(" ; "); const body = parts.slice(0, -1).map((s) => s + ";").join(" ") + " return (" + parts[parts.length - 1] + ");"; return eval("(()=>{" + body + "})()"); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 1000), rnd = mul(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const program = () => {
    const N = 2 + Math.floor(rnd() * 7);        // loop bound 2..8
    const acc0 = String(Math.floor(rnd() * 5));
    const upd = pick(["+", "*", "-"]);
    const stmts = [`let acc = ${acc0}`, `let i = 1`,
      `while ( i <= ${N} ) { acc = acc ${upd} i ; i = i + 1 }`];
    // Final: acc, or a comparison of acc against a literal.
    const fin = rnd() < 0.5 ? "acc" : `acc ${pick(["<", ">", "<=", ">=", "==", "!="])} ${Math.floor(rnd() * 60)}`;
    stmts.push(fin);
    return stmts.join(" ; ");
  };
  let checked = 0;
  for (let i = 0; i < n; i++) {
    const p = program();
    let ref; try { ref = nodeRun(p); } catch { continue; }
    if (typeof ref === "number" && (!Number.isInteger(ref) || Math.abs(ref) > 1e15)) continue;
    ref = String(ref);
    const got = run(p);
    if (got !== ref) fails.push(`jsRun(${JSON.stringify(p)}): ours=${got} node=${ref}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-loop: ${checked} while-loop programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL jsint-loop: " + f); process.exit(1); }
