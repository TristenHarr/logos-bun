// fuzz/jsint/regexlit-diff — regex LITERALS (E4.2): /pat/flags rewritten to new RegExp("pat")
// by desugarRegexLits before normJs, so a literal is byte-faithful to the tested new RegExp path
// (same hand-rolled matcher: literals, ., \d \w \s, [..] classes, * + ?, ^ $). This fuzzer drives
// the SAME validated pattern subset as regex-diff but through LITERAL syntax in argument,
// assignment, and return positions — which also exercises the regex-vs-division disambiguator.
// Whole programs run through `bun run` and diffed (stdout) vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const NODE = process.execPath;
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dir = mkdtempSync(join(tmpdir(), "rxlit-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const words = ["hello", "world42", "abc", "XYZ", "a1b2c3", "  spaced ", "2026", "foo_bar", "10", "20"];
  const J = (x) => JSON.stringify(x);
  const w = () => words[ri(words.length)];
  const program = () => {
    const k = ri(10), s = w();
    if (k === 0) return `console.log(/abc/.test(${J(s)}));`;
    if (k === 1) return `console.log(/\\d+/.test(${J(s)}));`;
    if (k === 2) return `console.log(/^[a-z]+$/.test(${J(s)}));`;
    if (k === 3) return `console.log(/[A-Z]/.test(${J(s)}));`;
    if (k === 4) return `console.log(/\\w+/.test(${J(s)}));`;
    if (k === 5) return `let m=${J(s)}.match(/\\d+/);console.log(m===null?"none":m[0]);`;
    if (k === 6) return `console.log(/^\\s/.test(${J(s)}));`;
    if (k === 7) return `let r=/a.c/;console.log(r.test(${J(s)}));`;                 // assignment position
    if (k === 8) return `function f(x){return /\\d/.test(x);}\nconsole.log(f(${J(s)}));`; // return position
    return `console.log(${(ri(6) + 1) * 4}/4);`;                                    // division must survive (exact)
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src);
    const got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${J(src)}): ours=${J(got)} node=${J(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-regexlit: ${checked} regex-literal programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-regexlit: " + f); process.exit(1); }
