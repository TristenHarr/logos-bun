// fuzz/jsint/parseint-diff — parseInt (lenient) and Number (strict) on integer inputs. parseInt
// takes the leading digit run after optional whitespace+sign and ignores the tail ("42px"->42), NaN
// with no leading digit. Number requires the whole trimmed string be numeric ("42px"->NaN, ""->0).
// Neither may call the native parseInt on arbitrary text (it PANICS) — these must be pure-LOGOS.
// (Floats are a separate integer-only-engine gap and are excluded.) Diffed vs Node.
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
const dir = mkdtempSync(join(tmpdir(), "pint-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const J = (x) => JSON.stringify(x);
  const inputs = ["42", "  17  ", "-8abc", "abc", "100", "3 apples", "", "0", "007", "+5", " -9 ", "12x34", "99red"];
  const inp = () => inputs[ri(inputs.length)];
  const program = () => {
    const k = ri(3), s = inp();
    if (k === 0) return `console.log(String(parseInt(${J(s)})));`;
    if (k === 1) return `console.log(String(Number(${J(s)})));`;
    return `let v=parseInt(${J(s)});console.log(String(v)+"|"+(v>10));`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src);
    const got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${J(src)}): ours=${J(got)} node=${J(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-parseint: ${checked} parseInt/Number programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-parseint: " + f); process.exit(1); }
