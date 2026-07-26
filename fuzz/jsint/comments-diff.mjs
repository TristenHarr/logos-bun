// fuzz/jsint/comments — comment handling. `//` line and `/* */` block comments are stripped before the
// keyword desugars, so a keyword INSIDE a comment (`// an error class`, `/* function foo */`) can never be
// mistaken for code and swallow what follows. A `//` or `/*` inside a STRING is not a comment; a division
// `/` is preserved; a comment may carry non-ASCII (exercising the char-vs-byte index fix in brace
// detection). Diffed vs Node.
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
  const kw = () => ["class", "function", "return", "if", "for", "while", "async", "yield", "throw", "const", "=> {"][ri(11)];
  const program = () => {
    const a = 1 + ri(20), b = 1 + ri(20), k = ri(9);
    if (k === 0) return `// this is a ${kw()} in a line comment\nconsole.log(${a} + ${b});`;
    if (k === 1) return `/* a ${kw()} inside a block comment */\nconsole.log(${a} * ${b});`;
    if (k === 2) return `function f() {\n  // an error ${kw()} to avoid false positives\n  return ${a};\n}\nconsole.log(f());`;
    if (k === 3) return `const x = ${a} /* inline ${kw()} */ + ${b};\nconsole.log(x);`;
    if (k === 4) return `/*---\ndescription: |\n    An error ${kw()} to avoid false positives when testing\ndefines: [Foo, $BAR]\n---*/\nconsole.log("ok", ${a});`;
    if (k === 5) return `console.log("http://example.com/${a}");\nconsole.log(${a} / ${1 + ri(4)} | 0);`;
    if (k === 6) return `const s = "a // not a comment ${kw()}";\nconsole.log(s.length > 0, ${a});`;
    if (k === 7) return `// café ${kw()} résumé → ${a}\nconsole.log("unicode-comment", ${b});`;
    return `class P {\n  // a ${kw()} in a class body\n  m() { return ${a}; }\n}\nconsole.log(new P().m());`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "cmf-"));
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-comments: ${checked} comment programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-comments: " + f); process.exit(1); }
