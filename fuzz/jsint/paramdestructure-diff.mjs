// fuzz/jsint/paramdestructure-diff — function PARAMETER destructuring + defaults:
// function f({a, b}) / f([x, y]) / ({a, b}) => … (the options-object idiom), field
// defaults {a, b = 1}, rename {a: x}, and simple-param defaults f(a, b = 10). callFn
// splits params/args bracket-aware (patFields), funcValueOf finds the body after the
// param ')', and bindParams destructures a {-or-[ param via destructureObj/Arr; a
// missing arg is undefined (defaults fill in). Scoped to DEFINED bindings (no missing
// arg used in arithmetic — the undefined→NaN gap). Diffed vs Node.
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
  for (const c of p) { if (c === "{" || c === "(" || c === "[") depth++; else if (c === "}" || c === ")" || c === "]") depth--; if (c === ";" && depth === 0) { parts.push(cur); cur = ""; } else cur += c; }
  parts.push(cur);
  const body = parts.slice(0, -1).map((s) => s + ";").join("") + " return (" + parts[parts.length - 1] + ");";
  return eval("(()=>{" + body + "})()");
};
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const sn = () => 1 + ri(9);
  const program = () => {
    const k = ri(9);
    if (k === 0) return `function f({a,b}){return a+b};f({a:${sn()},b:${sn()}})`;                 // object param
    if (k === 1) return `function f({a,b,c}){return a*b-c};f({a:${sn()},b:${sn()},c:${sn()}})`;    // 3-field
    if (k === 2) return `function f({a:x,b:y}){return x-y};f({a:${sn()},b:${sn()}})`;              // rename
    if (k === 3) return `function f([a,b]){return a*b};f([${sn()},${sn()}])`;                      // array param
    if (k === 4) { const present = ri(2); return `function f({a,b=${sn()}}){return a+b};f({a:${sn()}${present ? `,b:${sn()}` : ""}})`; } // field default
    if (k === 5) { const two = ri(2); return `function f(a,b=${sn()}){return a+b};f(${sn()}${two ? `,${sn()}` : ""})`; } // simple-param default
    if (k === 6) return `let g=({a,b})=>a*b+${sn()};g({a:${sn()},b:${sn()}})`;                     // arrow param destructure
    if (k === 7) return `function f(a,{b,c}){return a+b+c};f(${sn()},{b:${sn()},c:${sn()}})`;      // mixed
    return `function greet({name}){return "hi "+name};greet({name:"${["bun","node","deno"][ri(3)]}"})`; // string field
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = nodeRun(p); } catch { continue; }
    ref = String(ref);
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-paramdestructure: ${checked} param-destructuring programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-paramdestructure: " + f); process.exit(1); }
