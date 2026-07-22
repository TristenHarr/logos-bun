// fuzz/jsint/methodthis-diff — object methods with `this` (E1 foundation). A function-valued
// property called as `obj.method(args)` runs with `this` bound to the receiver, so `this.x`
// reads and `this.x = v` writes the receiver's own heap slots (mutation persists through the
// handle). Covers read-this, arg + this, this-write persistence, and accumulate-across-calls.
// Diffed vs Node.
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
    const k = ri(8), a = sn(), b = sn(), c = sn();
    if (k === 0) return `let o={x:${a},get:function(){return this.x}};o.get()`;
    if (k === 1) return `let o={x:${a},add:function(k){return this.x+k}};o.add(${b})`;
    if (k === 2) return `let o={a:${a},b:${b},sum:function(){return this.a+this.b}};o.sum()`;
    if (k === 3) return `let o={x:${a},setx:function(v){this.x=v}};o.setx(${b});o.x`;
    if (k === 4) return `let o={n:${a},inc:function(){this.n=this.n+1}};o.inc();o.inc();o.n`;
    if (k === 5) return `let o={x:${a},dbl:function(){this.x=this.x*2;return this.x}};o.dbl()`;
    if (k === 6) return `let o={xs:[${a}],push:function(v){this.xs.push(v)}};o.push(${b});o.xs.join(",")`;
    return `let o={v:${a},chain:function(k){this.v=this.v+k;return this.v}};o.chain(${b})+o.chain(${c})`;
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
  if (!fails.length) console.log(`PASS jsint-methodthis: ${checked} method/this programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-methodthis: " + f); process.exit(1); }
