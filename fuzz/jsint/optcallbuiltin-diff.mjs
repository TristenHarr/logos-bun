// fuzz/jsint/optcallbuiltin — optional CALLS on non-null ARRAY / STRING receivers (a?.map(...),
// s?.toUpperCase(), a?.filter(...)?.join(...), chained a?.slice()?.sort(...).join(...)). resolveOptCall
// rewrote `recv ?. m ( args )` to a plain dotted call, but joined `mname " " afterCall` where afterCall
// carried a leading space — yielding `a . map  ( … )` (DOUBLE space). leftmostMethod matches ` . map (`
// EXACTLY, so the double space made it miss, array/string builtins never dispatched (NaN / literal), and
// a chained `.join` after the malformed call sent resolveArrays into unbounded recursion (stack overflow).
// The rewrite now trims afterCall's leading space. Objects were unaffected (they dispatch after the
// space-collapse pass). Nullish short-circuit + object opt-calls + plain calls are regression controls.
// Diffed vs Node (`bun run`).
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "ocb-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const len = 1 + ri(6);
    const arr = Array.from({ length: len }, () => ri(9));
    const arrLit = "[" + arr.join(",") + "]";
    const words = ["alpha", "Beta", "gamma", "DELTA", "eps"];
    const s = JSON.stringify(words[ri(words.length)] + ri(9));
    const k = ri(14);
    // array optional-call, single method, terminal .join for a stable string output
    if (k === 0) return `const a=${arrLit};console.log(a?.map(x=>x*2).join(","))`;
    if (k === 1) return `const a=${arrLit};console.log(a?.filter(x=>x%2===0)?.join("-"))`;
    if (k === 2) return `const a=${arrLit};console.log(a?.reduce((x,y)=>x+y,0))`;
    if (k === 3) return `const a=${arrLit};console.log(a?.slice()?.sort((x,y)=>x-y).join("|"))`;
    if (k === 4) return `const a=${arrLit};console.log(a?.includes(${arr[0]}))`;
    if (k === 5) return `const a=${arrLit};console.log(a?.indexOf(${arr[ri(len)]}))`;
    // string optional-call
    if (k === 6) return `const s=${s};console.log(s?.toUpperCase())`;
    if (k === 7) return `const s=${s};console.log(s?.split("")?.reverse()?.join(""))`;
    if (k === 8) return `const s=${s};console.log(s?.slice(1)?.padStart(6,"*"))`;
    if (k === 9) return `const s=${s};console.log(s?.length)`;
    // deep chain mixing container + string ops
    if (k === 10) return `const o={items:${arrLit}};console.log(o?.items?.filter(x=>x>0)?.map(x=>x+1)?.join("."))`;
    // nullish short-circuit — regression control
    if (k === 11) return `const a=null;console.log(a?.map(x=>x*2)??"none")`;
    // object optional-call — regression control
    if (k === 12) return `const o={m(x){return x*3}};console.log(o?.m(${arr[0]}))`;
    // plain (non-optional) call — regression control
    return `const a=${arrLit};console.log(a.map(x=>x+1).join(","))`;
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
  if (!fails.length) console.log(`PASS jsint-optcallbuiltin: ${checked} array/string optional-call programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-optcallbuiltin: " + f); process.exit(1); }
