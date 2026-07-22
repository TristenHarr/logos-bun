// fuzz/jsint/strmethods2-diff — the remaining common String methods: substr(start,len) (start may be
// negative = from end; distinct from substring), codePointAt(i) (== charCodeAt for the BMP), and
// lastIndexOf(sub) (last 0-based occurrence or -1). Diffed vs Node.
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
const dir = mkdtempSync(join(tmpdir(), "sm2-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const J = (x) => JSON.stringify(x);
  const words = ["hello", "abcabc", "mississippi", "OpenAI", "a.b.c", "banana"];
  const w = () => words[ri(words.length)];
  const idx = () => ri(8) - 3;
  const ch = () => "abcinsp.".charAt(ri(8));
  const program = () => {
    const k = ri(5), s = w();
    if (k === 0) return `console.log(${J(s)}.substr(${idx()},${1 + ri(4)}));`;
    if (k === 1) return `console.log(${J(s)}.substr(${idx()}));`;
    if (k === 2) return `console.log(String(${J(s)}.codePointAt(${ri(6)})));`;
    if (k === 3) return `console.log(${J(s)}.lastIndexOf(${J(ch())}));`;
    return `console.log(${J(s)}.lastIndexOf(${J(s.slice(ri(3), ri(3) + 2))}));`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src);
    const got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${J(src)}): ours=${J(got)} node=${J(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-strmethods2: ${checked} substr/codePointAt/lastIndexOf agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-strmethods2: " + f); process.exit(1); }
