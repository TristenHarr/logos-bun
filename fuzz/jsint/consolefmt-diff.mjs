// fuzz/jsint/consolefmt — console.log util.format `%`-specifiers: %s (inspect), %d (Number, no truncation),
// %i (truncate), %f (parseFloat), %o/%O (inspect), %j (JSON), %c (consume, emit nothing), %% (literal %).
// Substitution happens only when the first argument is a string and there is >1 argument; a specifier with
// no remaining argument, or an unknown %x, stays literal; leftover arguments are appended. Non-format
// console.log (no specifiers, non-string first arg, single arg) is a regression control. Diffed vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dir = OURS ? mkdtempSync(join(tmpdir(), "cf-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const num = () => ri(2) ? String(1 + ri(999)) : (1 + ri(99)) + "." + ri(99);
  const program = () => {
    const a = 1 + ri(9), b = 1 + ri(9), k = ri(14);
    if (k === 0) return `console.log("%s and %d", "str${a}", ${b})`;
    if (k === 1) return `console.log("%d %d %d", ${a}, ${b}, ${a + b})`;
    if (k === 2) return `console.log("%s", "x", "y", "z")`;                 // leftover append
    if (k === 3) return `console.log("%i vs %f", ${num()}, ${num()})`;
    if (k === 4) return `console.log("%d", ${num()})`;                       // Number, no trunc
    if (k === 5) return `console.log("%o", {a:${a},b:${b}})`;
    if (k === 6) return `console.log("%j", {k:${a}})`;
    if (k === 7) return `console.log("val=%s end", ${a})`;
    if (k === 8) return `console.log("pct %% and %d", ${a})`;
    if (k === 9) return `console.log("%q leftover", ${a})`;                  // unknown specifier
    if (k === 10) return `console.log("%s %s", ${a})`;                        // missing arg -> literal
    // regression controls — no format substitution
    if (k === 11) return `console.log("plain", ${a}, ${b})`;                  // no specifiers
    if (k === 12) return `console.log(${a}, ${b})`;                           // non-string first
    return `console.log({x:${a}}, [${a},${b}])`;                             // object first
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    const ref = runFile("node", p);
    const got = runFile(OURS, p);
    if (got !== ref) fails.push(`run(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  rmSync(dir, { recursive: true, force: true });
  if (!fails.length) console.log(`PASS jsint-consolefmt: ${checked} console-format programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-consolefmt: " + f); process.exit(1); }
