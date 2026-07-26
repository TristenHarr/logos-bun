// fuzz/jsint/infinityarith — Infinity / -Infinity / NaN as arithmetic OPERANDS. They exist and print, but
// `arithBadTok` rejected them and the integer path turned `Infinity + 1` into NaN; bare `-Infinity` never
// folded its sign. Fixes: isSignFoldable lets a unary `-` fuse with Infinity, arithBadTok accepts
// Infinity/-Infinity/NaN, and needsFloat routes them to the IEEE-754 (jsArithF64) path. Plain finite
// arithmetic, unary signs, and division-to-infinity are regression controls. Diffed vs Node.
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "ia-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const inf = () => ["Infinity", "-Infinity"][ri(2)];
  const op = () => ["+", "-", "*"][ri(3)];
  const num = () => 1 + ri(20);
  const program = () => {
    const k = ri(12);
    if (k === 0) return `console.log(-Infinity)`;
    if (k === 1) return `console.log(${inf()} ${op()} ${num()})`;
    if (k === 2) return `console.log(${num()} ${op()} ${inf()})`;
    if (k === 3) return `console.log(${inf()} < ${num()}, ${inf()} > ${num()})`;
    if (k === 4) return `console.log(Math.min(${num()}, -Infinity), Math.max(${num()}, Infinity))`;
    if (k === 5) return `let x = ${inf()}; console.log(x + ${num()}, x < 0)`;
    if (k === 6) return `console.log([Infinity, -Infinity, NaN].map(v => v ${op()} ${num()}).join(","))`;
    if (k === 7) return `console.log(NaN ${op()} ${num()})`;
    if (k === 8) return `console.log(-(2 ** 1024))`;                    // overflow -> -Infinity
    // regression controls — finite arithmetic must be untouched
    if (k === 9) return `console.log(${num()} ${op()} -${num()})`;      // unary sign
    if (k === 10) return `console.log(${num()} / ${num() - num()})`;    // maybe division to +/-Infinity or finite
    return `console.log(${num()} + ${num()} * ${num()})`;              // precedence
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
  if (!fails.length) console.log(`PASS jsint-infinityarith: ${checked} infinity-arithmetic programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-infinityarith: " + f); process.exit(1); }
