// fuzz/jsint/function-diff — the P7 JS engine running FUNCTIONS + RECURSION
// (definitions, parameter binding, return incl. return-from-nested-block,
// recursive + multiple calls in expressions), differential-fuzzed vs Node eval.
// Mixes known recursive templates (factorial/triangular/countdown/power) with
// random non-recursive functions; bounded args so recursion terminates + i64.
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
const nodeRun = (p) => { const parts = p.split(";"); const body = parts.slice(0, -1).map((s) => s + ";").join("") + " return (" + parts[parts.length - 1] + ");"; return eval("(()=>{" + body + "})()"); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 800), rnd = mul(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const recTemplates = [
    (N) => [`function f(n){if(n<=1){return 1};return n*f(n-1)}`, `f(${N})`],       // factorial
    (N) => [`function f(n){if(n<=0){return 0};return n+f(n-1)}`, `f(${N})`],        // triangular sum
    (N) => [`function f(n){if(n<2){return n};return f(n-1)+f(n-2)}`, `f(${N})`],    // fibonacci
    (N) => [`function f(n){if(n<=0){return 1};return 2*f(n-1)}`, `f(${N})`],        // power of 2
    (N) => [`function f(n){if(n<=0){return 0};return f(n-1)+2}`, `f(${N})`],        // 2n
  ];
  const program = () => {
    if (rnd() < 0.6) {
      const N = 1 + Math.floor(rnd() * 8);                     // small so it terminates + fits i64
      const [def, call] = pick(recTemplates)(N);
      const post = rnd() < 0.3 ? `+${Math.floor(rnd() * 10)}` : "";
      return `${def};${call}${post}`;
    }
    // non-recursive: return an arithmetic expr of the param, called (maybe twice).
    const op = pick(["+", "*", "-"]), k = Math.floor(rnd() * 9);
    const def = `function g(x){return x${op}${k + 1}}`;
    const a = Math.floor(rnd() * 12), b = Math.floor(rnd() * 12);
    const call = rnd() < 0.5 ? `g(${a})` : `g(${a})+g(${b})`;
    return `${def};${call}`;
  };
  let checked = 0;
  for (let i = 0; i < n; i++) {
    const p = program();
    let ref; try { ref = nodeRun(p); } catch { continue; }
    if (typeof ref === "number" && (!Number.isInteger(ref) || Math.abs(ref) > 1e15)) continue;
    ref = String(ref);
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${got} node=${ref}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-function: ${checked} function/recursion programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL jsint-function: " + f); process.exit(1); }
