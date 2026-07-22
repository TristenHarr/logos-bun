// fuzz/jsint/squote-diff — single-quoted string literals (the tokenizer only knew "), normalized to
// double-quoted by convertQuotes: inner " becomes \", \' becomes ', delimiters flip. Covers single
// quotes in assignment/argument/object-value/array/concat positions, escaped ' and embedded ",
// mixed single+double, and JSON.parse of a single-quoted JSON literal. Diffed vs Node.
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
const dir = mkdtempSync(join(tmpdir(), "sq-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const words = ["abc", "hi there", "x", "42", "a,b,c"];
  const w = () => words[ri(words.length)];
  const sq = (x) => "'" + x + "'";
  const program = () => {
    const k = ri(6), a = w(), b = w();
    if (k === 0) return `console.log(${sq(a)});`;
    if (k === 1) return `let x=${sq(a)};console.log(x+${sq(b)});`;
    if (k === 2) return `let o={k:${sq(a)}};console.log(o.k);`;
    if (k === 3) return `console.log([${sq(a)},${sq(b)}].join('|'));`;
    if (k === 4) return `console.log('say \\'hi\\' now');`;
    return `console.log(JSON.parse('{"v":${1 + ri(9)}}').v);`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src);
    const got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-squote: ${checked} single-quote programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-squote: " + f); process.exit(1); }
