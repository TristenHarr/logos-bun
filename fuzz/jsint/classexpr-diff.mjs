// fuzz/jsint/classexpr — a class in EXPRESSION position bound by `var/let/const NAME = class …` is
// desugared using the binding name as the class name (a class declaration binds NAME to the same
// constructor), so instance methods, static methods, constructors, private fields, and named class
// expressions all work. Diffed vs Node. (Deferred: generator methods in a class, `extends` inside a class
// expression, and class expressions in non-binding positions — return class{}, foo(class{}).)
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
  const kw = () => ["var", "let", "const"][ri(3)];
  const program = () => {
    const a = 1 + ri(20), b = 1 + ri(20), k = ri(10);
    if (k === 8) return `class C { *g(){ yield ${a}; yield ${b}; } }\nvar it = new C().g();\nconsole.log(it.next().value, it.next().value, it.next().done);`;
    if (k === 9) return `${kw()} C = class { n = ${a}; *g(){ yield this.n; yield this.n + ${b}; } };\nconsole.log([...new C().g()].join(","));`;
    if (k === 0) return `${kw()} C = class { m(){ return ${a}; } };\nconsole.log(new C().m());`;
    if (k === 1) return `${kw()} C = class { static s(){ return ${a} + ${b}; } };\nconsole.log(C.s());`;
    if (k === 2) return `${kw()} C = class { constructor(x){ this.x = x; } g(){ return this.x * 2; } };\nconsole.log(new C(${a}).g());`;
    if (k === 3) return `${kw()} C = class Named { who(){ return "N${a}"; } };\nconsole.log(new C().who());`;
    if (k === 4) return `${kw()} C = class { #p = ${a}; take(){ return this.#p + ${b}; } };\nconsole.log(new C().take());`;
    if (k === 5) return `${kw()} C = class { a(){ return ${a}; } b(){ return this.a() + ${b}; } };\nconsole.log(new C().b());`;
    if (k === 6) return `${kw()} C = class { static #v = ${a}; static get(){ return C.#v; } };\nconsole.log(C.get());`;
    return `${kw()} P = class { hi(){ return ${a}; } };\n${kw()} q = new P();\nconsole.log(q.hi(), typeof P);`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "clef-"));
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-classexpr: ${checked} class-expression programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-classexpr: " + f); process.exit(1); }
