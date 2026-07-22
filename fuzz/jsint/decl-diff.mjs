// fuzz/jsint/decl-diff — DECLARATION KEYWORDS: `const` and `var` are accepted as
// binding forms alongside `let` (all three route to the same bindAssign). Random
// programs mix let/const/var (values, arrows, arithmetic, block-scoped bindings in
// loop bodies) and are run through logos-bun __js AND Node eval, required to agree.
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
    if (c === "{" || c === "(" || c === "[") depth++;
    else if (c === "}" || c === ")" || c === "]") depth--;
    if (c === ";" && depth === 0) { parts.push(cur); cur = ""; } else cur += c;
  }
  parts.push(cur);
  const body = parts.slice(0, -1).map((s) => s + ";").join("") + " return (" + parts[parts.length - 1] + ");";
  return eval("(()=>{" + body + "})()");
};
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const sn = () => 1 + ri(9);
  const kw = () => ["let", "const", "var"][ri(3)];
  const program = () => {
    const k = ri(9);
    if (k === 0) return `${kw()} x=${sn()};x+${sn()}`;
    if (k === 1) return `${kw()} a=${sn()};${kw()} b=${sn()};a*b`;
    if (k === 2) return `${kw()} f=x=>x*x;f(${sn()})`;
    if (k === 3) return `${kw()} n=${sn()};n>3?"big":"small"`;
    if (k === 4) return `let t=0;for(let i=0;i<${2 + ri(4)};i++){${kw()} d=i*2;t+=d};t`;
    if (k === 5) return `let x;typeof x`;                                  // uninitialized -> "undefined"
    if (k === 6) return `let x;x??${sn()}`;                                // undefined ?? default
    if (k === 7) return `let x;x=${sn()};x+${sn()}`;                       // declare then assign
    return `${kw()} a=${sn()};${kw()} b=${sn()};${kw()} c=${sn()};a+b+c`;
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
  if (!fails.length) console.log(`PASS jsint-decl: ${checked} const/var/let programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-decl: " + f); process.exit(1); }
