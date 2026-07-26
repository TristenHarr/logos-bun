// fuzz/jsint/multiline — multi-line function bodies and bracket groups. A raw newline inside a { } block
// is a statement separator, inside an object literal / call-arg list it is whitespace, and only at the top
// level is it a statement boundary. Before the splitTop brace-kind-stack fix, a newline inside a function
// body leaked into the TOP-LEVEL statement split, tearing `function f(){ … }` into pieces so defineFn
// stored an empty body (every multi-line function returned undefined/NaN). This exercises multi-line
// bodies (vars, reassignment, object mutation, `new`, if/for, early return), multi-line object literals,
// and multi-line call-arg lists — run as real files (bun run) so the newlines are genuine. Diffed vs Node.
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
  const a = () => 1 + ri(20), b = () => 1 + ri(20);
  const program = () => {
    const x = a(), y = b(), k = ri(12);
    if (k === 0) return `function f() {\n  let s = ${x} + ${y};\n  return s;\n}\nconsole.log(f());`;
    if (k === 1) return `function f() {\n  let a = ${x};\n  a = a + ${y};\n  return a;\n}\nconsole.log(f());`;
    if (k === 2) return `function f() {\n  const m = {};\n  m.x = ${x};\n  m.y = ${y};\n  return m.x + m.y;\n}\nconsole.log(f());`;
    if (k === 3) return `function f() {\n  const m = new Map();\n  m.set("k", ${x});\n  return m.get("k");\n}\nconsole.log(f());`;
    if (k === 4) return `function f() {\n  const arr = [];\n  for (let i = 0; i < ${1 + ri(5)}; i++) {\n    arr.push(i * ${x});\n  }\n  return arr.reduce((s, v) => s + v, 0);\n}\nconsole.log(f());`;
    if (k === 5) return `function f(n) {\n  if (n > ${x}) {\n    return "big";\n  }\n  return "small";\n}\nconsole.log(f(${y}));`;
    if (k === 6) return `function f() {\n  try {\n    return ${x} + ${y};\n  } catch (e) {\n    return -1;\n  }\n}\nconsole.log(f());`;
    if (k === 7) return `function add(p, q) {\n  return p + q;\n}\nconsole.log(add(\n  ${x},\n  ${y}\n));`;
    if (k === 8) return `function fact(n) {\n  let r = 1;\n  while (n > 1) {\n    r = r * n;\n    n = n - 1;\n  }\n  return r;\n}\nconsole.log(fact(${1 + ri(5)}));`;
    if (k === 9) return `class P {\n  constructor(v) {\n    this.v = v;\n  }\n  double() {\n    return this.v * 2;\n  }\n}\nconst p = new P(${x});\nconsole.log(p.double());`;
    if (k === 10) return `function outer() {\n  let c = ${x};\n  const inc = () => {\n    c = c + 1;\n    return c;\n  };\n  inc();\n  return inc();\n}\nconsole.log(outer());`;
    return `function f() {\n  const u = new URL("https://ex${x}.com:${8000 + y}/p?q=${y}#h");\n  return u.hostname + ":" + u.port + u.pathname;\n}\nconsole.log(f());`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "mlf-"));
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-multiline: ${checked} multi-line programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-multiline: " + f); process.exit(1); }
