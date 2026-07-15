// fuzz/jsint/mapfilter-diff — the P7 JS engine's HIGHER-ORDER ARRAY methods
// .map(fn) and .filter(fn), differential-fuzzed vs Node eval — closures + arrays +
// higher-order together. arrMapLoop/arrFilterLoop apply a named function value to
// each element via callFn; the function value and env are cloned with concat(x,"")
// per element (native concat borrows, so it copies) to sidestep the E0382 that a
// LOGOS call otherwise causes by consuming a param it must also pass recursively.
// The fn is a NAMED function (a.map(f)) — an inline `function(){}` arg would collide
// with the paren-based arg extraction, and can itself be a closure. Covers map
// (double/square/+k), filter (even/gt), and chained map().join().
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
const nodeRun = (p) => {
  let depth = 0, parts = [], cur = "";
  for (const c of p) {
    if (c === "{" || c === "(") depth++;
    else if (c === "}" || c === ")") depth--;
    if (c === ";" && depth === 0) { parts.push(cur); cur = ""; } else cur += c;
  }
  parts.push(cur);
  const body = parts.slice(0, -1).map((s) => s + ";").join("") + " return (" + parts[parts.length - 1] + ");";
  return eval("(()=>{" + body + "})()");
};
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const arr = () => { const len = 2 + Math.floor(rnd() * 5); return "[" + Array.from({ length: len }, () => Math.floor(rnd() * 12)).join(",") + "]"; };
  const program = () => {
    const a = arr();
    const k = rnd();
    if (k < 0.22) return `let f=function(x){return x*2};let a=${a};a.map(f)`;
    if (k < 0.42) { const c = 1 + Math.floor(rnd() * 5); return `let f=function(x){return x+${c}};let a=${a};a.map(f)`; }
    if (k < 0.55) return `let f=function(x){return x*x};let a=${a};a.map(f)`;
    if (k < 0.72) return `let f=function(x){return x%2==0};let a=${a};a.filter(f)`;
    if (k < 0.88) { const t = 1 + Math.floor(rnd() * 8); return `let f=function(x){return x>${t}};let a=${a};a.filter(f)`; }
    const c = 1 + Math.floor(rnd() * 4); return `let f=function(x){return x+${c}};let a=${a};a.map(f).join("-")`; // map then join
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = nodeRun(p); } catch { continue; }
    if (Array.isArray(ref) && ref.some((v) => !Number.isInteger(v) || Math.abs(v) > 1e15)) continue;
    ref = String(ref);
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-mapfilter: ${checked} map/filter programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL jsint-mapfilter: " + f); process.exit(1); }
