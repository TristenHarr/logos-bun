// fuzz/jsint/optcallvalue — optional CALL of a function VALUE: `f?.()` / `o.f?.(args)` (the `?.()` form
// with NO method name between `?.` and `(`). It used to return the function itself instead of invoking it
// (only the nullish short-circuit worked). optCallPos now also matches `?.` directly before `(`, and
// resolveOptCall juxtaposes the args onto the receiver for resolveCalls. Nullish short-circuit + the
// method form (o?.m()) + plain calls are regression controls. Diffed vs Node (`bun run`).
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "ocv-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = ri(20), b = ri(20), k = ri(9);
    if (k === 0) return `const o={f:()=>${a}};console.log(o.f?.())`;
    if (k === 1) return `const o={};console.log(o.f?.()??"none")`;                              // nullish short-circuit
    if (k === 2) return `const f=(x)=>x+${a};console.log(f?.(${b}))`;                            // bare var + arg
    if (k === 3) return `const add=(x,y)=>x+y;console.log(add?.(${a},${b}))`;                    // two args
    if (k === 4) return `const o={f:()=>({g:()=>${a}})};console.log(o.f?.().g?.())`;             // chained ?.()
    if (k === 5) return `const o={cb:null};console.log(o.cb?.(${a})??"skip")`;                   // null fn short-circuit
    if (k === 6) return `const o={m(x){return x*2}};console.log(o?.m(${a}))`;                    // method form control
    if (k === 7) return `const o={f:x=>x*x};console.log(o.f?.(${a}))`;                           // property fn + arg
    return `const o={f:()=>${a}};console.log(o.f())`;                                            // plain call control
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
  if (!fails.length) console.log(`PASS jsint-optcallvalue: ${checked} optional-call-of-value programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-optcallvalue: " + f); process.exit(1); }
