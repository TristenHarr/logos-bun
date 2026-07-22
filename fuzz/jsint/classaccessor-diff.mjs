// fuzz/jsint/classaccessor-diff — class getters/setters (E1). `get x(){…}` / `set x(v){…}` are
// stored as __get_x / __set_x function slots; member ACCESS `obj.x` invokes the getter with
// `this`, member ASSIGN `obj.x = v` invokes the setter. Covers plain getters, computed getters,
// setter+getter round-trips, and getters used in larger expressions. Diffed vs Node.
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
    const k = ri(5), a = sn(), b = sn();
    if (k === 0) return `class T{constructor(c){this._c=c}get v(){return this._c}};let t=new T(${a});t.v`;
    if (k === 1) return `class T{constructor(c){this._c=c}get f(){return this._c*${b}}};let t=new T(${a});t.f`;
    if (k === 2) return `class B{constructor(){this._v=${a}}set val(x){this._v=x}get val(){return this._v}};let o=new B();o.val=${b};o.val`;
    if (k === 3) return `class C{get k(){return ${a}}};let c=new C();c.k+${b}`;
    return `class P{constructor(x,y){this._x=x;this._y=y}get sum(){return this._x+this._y}};let p=new P(${a},${b});p.sum`;
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
  if (!fails.length) console.log(`PASS jsint-classaccessor: ${checked} getter/setter programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-classaccessor: " + f); process.exit(1); }
