// fuzz/jsint/relarr — a relational operator (`<`/`>`/`<=`/`>=`) on arrays/objects. JS runs ToPrimitive
// first, so `[1,2] < [1,3]` is `"1,2" < "1,3"` (string compare) and a plain object is "[object Object]".
// relFold treated an array ref as NaN (arrays ToNumber to NaN) and returned false; it now coerces each
// operand via cmpPrim (array -> its toString, object -> "[object Object]") before comparing, so the
// existing string-relational path handles it. Number/string/NaN relational are regression controls.
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "ra-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const arr = () => "[" + Array.from({ length: 1 + ri(3) }, () => ri(20)).join(",") + "]";
  const op = () => ["<", ">", "<=", ">="][ri(4)];
  const program = () => {
    const k = ri(9);
    if (k === 0) return `console.log(${arr()} ${op()} ${arr()})`;
    if (k === 1) return `let a=${arr()}, b=${arr()}; console.log(a ${op()} b)`;
    if (k === 2) return `console.log(${arr()} ${op()} "${ri(30)}")`;                 // array vs string
    if (k === 3) return `console.log([${ri(9)}] ${op()} ${ri(20)})`;                  // single-elem array vs number
    if (k === 4) return `console.log(({}) ${op()} ({}))`;                             // plain objects
    // regression controls
    if (k === 5) return `console.log(${ri(50)} ${op()} ${ri(50)})`;                   // number
    if (k === 6) return `console.log("s${ri(9)}" ${op()} "s${ri(9)}")`;               // string
    if (k === 7) return `console.log(NaN ${op()} ${ri(9)}, ${ri(9)} ${op()} NaN)`;    // NaN
    return `console.log([${ri(9)},${ri(9)},${ri(9)}].sort((x,y)=>x-y).join(","))`;    // sort comparator
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
  if (!fails.length) console.log(`PASS jsint-relarr: ${checked} relational programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-relarr: " + f); process.exit(1); }
