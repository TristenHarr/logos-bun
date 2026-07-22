// fuzz/jsint/strindex-diff — bracket indexing a string: s[i] is the one-char string at i, or
// undefined for a negative / out-of-range index (distinct from .charAt, which returns ""). Covers
// literals and variables, concatenation of chars, out-of-range/negative, and full char-iteration
// (for i<s.length: r+=s[i]). Diffed vs Node.
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
const dir = mkdtempSync(join(tmpdir(), "sidx-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const J = (x) => JSON.stringify(x);
  const words = ["hello", "abc", "world42", "x", "OpenAI", "a-b-c", "12345"];
  const w = () => words[ri(words.length)];
  const idx = () => ri(9) - 2;   // -2..6
  const program = () => {
    const k = ri(4), s = w();
    if (k === 0) return `console.log(String(${J(s)}[${idx()}]));`;
    if (k === 1) return `let s=${J(s)};console.log(String(s[${idx()}]));`;
    if (k === 2) return `let s=${J(s)};console.log(String(s[${ri(4)}])+String(s[${ri(4)}]));`;
    return `let s=${J(s)};\nlet r="";\nfor(let i=0;i<s.length;i++){r=r+s[i];}\nconsole.log(r);`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src);
    const got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${J(src)}): ours=${J(got)} node=${J(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-strindex: ${checked} string-index programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-strindex: " + f); process.exit(1); }
