// fuzz/jsint/bigint-diff — arbitrary-precision BigInt: `10n` literals, `+ - * / % **` (integer / that
// truncates toward zero, remainder %), typeof→"bigint", BigInt(n), and console.log's trailing-n
// inspect form — all via native base::BigInt, so 2n**100n and beyond are exact. Whole programs run
// through `bun run` and diffed vs Node.
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
const dir = mkdtempSync(join(tmpdir(), "big-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const b = () => `${1 + ri(999999)}n`;
  const op = () => ["+", "-", "*"][ri(3)];
  const program = () => {
    const k = ri(6);
    if (k === 0) return `console.log(${b()}${op()}${b()});`;
    if (k === 1) return `console.log(${1 + ri(30)}n**${ri(60)}n);`;
    if (k === 2) return `console.log(${1 + ri(999999)}n/${1 + ri(999)}n);`;
    if (k === 3) return `console.log(${1 + ri(999999)}n%${1 + ri(999)}n);`;
    if (k === 4) return `let x=${b()};let y=x*x+${b()};console.log(y);`;
    return `let x=BigInt(${1 + ri(99999)});console.log(x+"/"+typeof x);`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src);
    const got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-bigint: ${checked} BigInt programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-bigint: " + f); process.exit(1); }
