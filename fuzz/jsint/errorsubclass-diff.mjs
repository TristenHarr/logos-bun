// fuzz/jsint/errorsubclass — `class X extends Error { constructor(m){ super(m) } }`. `super(m)` to a
// built-in Error left `.message` undefined: the __super__ handler ran `callMethod(env["Error"], …)`, but
// Error is a builtin with no env binding, so the call was a no-op. Fixed: __super__ to a built-in error
// type (Error/TypeError/RangeError/SyntaxError/ReferenceError/EvalError/URIError) sets `this.name` = the
// type and `this.message` = the first super() argument (via the same assignTarget path as `this.f = v`);
// a same-constructor `this.name = "..."` override afterwards still wins, and user-class super() is
// unchanged. Exercises message/name, implicit ctors, message expressions, extra fields, throw/catch, and
// instanceof, diffed vs Node.
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
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 200), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const msg = () => "m" + ri(9999);
  const base = () => ["Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError"][ri(5)];
  const program = () => {
    const m = msg(), B = base(), k = ri(7);
    if (k === 0) return `(function(){class E extends ${B}{constructor(x){super(x)}}return new E(${JSON.stringify(m)}).message})()`;
    if (k === 1) return `(function(){class E extends ${B}{constructor(x){super(x)}}return new E(${JSON.stringify(m)}).name})()`;
    if (k === 2) return `(function(){class E extends ${B}{constructor(x){super(x);this.name="Custom"}}const e=new E(${JSON.stringify(m)});return e.name+"|"+e.message})()`;
    if (k === 3) return `(function(){class E extends ${B}{}return new E(${JSON.stringify(m)}).message})()`;   // implicit ctor
    if (k === 4) return `(function(){class E extends ${B}{constructor(f){super(f+"!");this.f=f}}const e=new E(${JSON.stringify(m)});return e.message+"/"+e.f})()`;
    if (k === 5) return `(function(){class E extends ${B}{constructor(x){super(x)}}try{throw new E(${JSON.stringify(m)})}catch(e){return e.message}})()`;
    return `(function(){class E extends ${B}{constructor(x){super(x)}}return new E(${JSON.stringify(m)}) instanceof ${B}})()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-errorsubclass: ${checked} Error-subclass super() programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-errorsubclass: " + f); process.exit(1); }
