// fuzz/jsint/optcall — optional method CALL `recv?.method(args)`. Method-call dispatch runs before the
// opt-chain rewrite, so `o?.m()` never dispatched (→ garbage/NaN, and array-builtin forms crashed). A new
// early resolveOptCall pass evaluates the receiver once, short-circuits to undefined if nullish (consuming
// the balanced call group, so a trailing `?? d` yields d), else rewrites `recv ?. m (args)` → `recv . m
// (args)` for normal dispatch — including chained `o?.f()?.g()` and the ubiquitous `r?.json()?.v`. Object
// receivers + chains are exercised; optional calls on a string/array BUILT-IN typed receiver remain a
// separate open gap. Diffed vs Node via a module file.
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "ocl-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 100), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = ri(50), b = ri(50), k = ri(7);
    if (k === 0) return `let o={m(){return ${a}}};console.log(o?.m())`;
    if (k === 1) return `let o=null;console.log(o?.m()??"none")`;
    if (k === 2) return `let user={getName(){return "u${a}"}};console.log(user?.getName())`;
    if (k === 3) return `let o={f(){return{g(){return ${a}}}}};console.log(o?.f()?.g())`;
    if (k === 4) return `let r={json(){return{v:${a}}}};console.log(r?.json()?.v)`;
    if (k === 5) return `let o={data:{fn(){return ${a}+${b}}}};console.log(o?.data.fn())`;
    return `let o={m(x){return x*2}};console.log(o?.m(${a}))`;
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
  if (!fails.length) console.log(`PASS jsint-optcall: ${checked} optional-call programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-optcall: " + f); process.exit(1); }
