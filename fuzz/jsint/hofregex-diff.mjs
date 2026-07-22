// fuzz/jsint/hofregex-diff — regex used inside a higher-order-function callback (map/filter/some/
// every). Method dispatch must NOT resolve `.test`/`.match`/`new RegExp` inside an un-executed
// arrow/function body at capture time (x unbound) — the enclosing HOF must capture the closure
// opaquely, and the regex resolves per-element when the callback runs. Regression lock for the
// function-body-aware markerInBody guard. Output shaped as .join/.length/boolean to avoid the
// (separate) array console.log formatting difference. Whole programs via `bun run`, diffed vs Node.
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
const dir = mkdtempSync(join(tmpdir(), "hofrx-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const words = ["a1", "b2", "zz", "foo", "bar42", "XYZ", "hello", "9", "x", "Q7"];
  const arr = () => { const len = 2 + ri(3); const xs = []; for (let i = 0; i < len; i++) xs.push(words[ri(words.length)]); return "[" + xs.map((x) => JSON.stringify(x)).join(",") + "]"; };
  const pats = ["/\\d/", "/[a-z]/", "/[A-Z]/", "/z/", "/\\w/", 'new RegExp("\\\\d")', 'new RegExp("[a-z]")'];
  const pat = () => pats[ri(pats.length)];
  const program = () => {
    const k = ri(5), a = arr(), p = pat();
    if (k === 0) return `console.log(${a}.filter(x=>${p}.test(x)).join(","));`;
    if (k === 1) return `console.log(${a}.map(x=>${p}.test(x)).join(","));`;
    if (k === 2) return `console.log(${a}.some(x=>${p}.test(x)));`;
    if (k === 3) return `console.log(${a}.every(x=>${p}.test(x)));`;
    return `console.log(${a}.filter(x=>${p}.test(x)).length);`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src);
    const got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-hofregex: ${checked} HOF+regex programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-hofregex: " + f); process.exit(1); }
