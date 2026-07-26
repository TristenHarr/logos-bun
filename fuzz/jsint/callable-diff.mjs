// fuzz/jsint/callable — functions as first-class objects. Attaching a property to a function boxes it into
// a callable object: it keeps `typeof fn === "function"`, stays callable, holds data + method properties,
// and works as a constructor (`new fn()` + instanceof). Also covers `this instanceof Ctor` INSIDE the
// constructor (the chain tag is set before the body runs), which powers the ubiquitous
// `if (!(this instanceof X)) return new X(...)` forgot-new guard. Diffed vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const NODE = "node";
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const run = (bin, dir, args) => { const r = spawnSync(bin, args, { encoding: "utf8", cwd: dir, timeout: 5000 }); return ((r.stdout || "") + (r.status ? "\n<exit:" + r.status + ">" : "")).trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = 1 + ri(20), b = 1 + ri(20), k = ri(8);
    if (k === 0) return `function f(){ return ${a}; }\nf.x = ${b};\nconsole.log(typeof f, f(), f.x);`;
    if (k === 1) return `function f(){}\nf.add = function(p, q){ return p + q; };\nconsole.log(f.add(${a}, ${b}));`;
    if (k === 2) return `function f(){}\nf._t = function(v){ return "<" + v + ">"; };\nf.wrap = function(v){ return f._t(v); };\nconsole.log(f.wrap(${a}));`;
    if (k === 3) return `function C(){ this.v = ${a}; }\nC.tag = "c";\nconst c = new C();\nconsole.log(c.v, c instanceof C, C.tag);`;
    if (k === 4) return `function E(m){ if (!(this instanceof E)) return new E(m); this.m = m; }\nconst e = new E(${a});\nconsole.log(e.m, e instanceof E);`;
    if (k === 5) return `function C(){ console.log("in:", this instanceof C); this.v = ${a}; }\nC.s = 1;\nnew C();`;
    if (k === 6) return `function f(){ return ${a}; }\nf.meta = { k: ${b} };\nconsole.log(f() + f.meta.k, typeof f);`;
    // NOTE: function REFERENCE-sharing (counter.n self-mutation, memo(fn) param-passing) is a deferred
    // follow-up — functions are value-copied, so boxing a property rebinds only the assigned binding.
    return `function Box(v){ this.v = v; }\nBox.of = function(v){ return new Box(v); };\nconst b1 = Box.of(${a});\nconsole.log(b1.v, b1 instanceof Box);`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "clf-"));
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-callable: ${checked} callable-object programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-callable: " + f); process.exit(1); }
