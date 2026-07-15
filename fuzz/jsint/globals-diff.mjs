// fuzz/jsint/globals-diff — the P7 JS engine's GLOBAL functions parseInt / String /
// Number / Boolean, differential-fuzzed vs Node eval. These are dispatched in
// resolveCalls (after user + inline function lookup, so a user fn of the same name
// would still win — declarer-wins): parseInt/Number coerce to an integer, String
// coerces to a chr(3) string, Boolean applies JS truthiness. Covers bare calls,
// results fed into arithmetic and string concat, and a variable argument. (Integer
// engine: parseInt("42px")/floats are out of scope; args are clean numeric strings
// or numbers.)
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const run = (p) => { const r = spawnSync(OURS, ["__js", p], { encoding: "utf8" }); return r.status !== 0 ? `ERR:${r.status}` : (r.stdout || "").replace(/\n$/, ""); };
const nodeRun = (p) => { const parts = p.split(";"); const body = parts.slice(0, -1).map((s) => s + ";").join("") + " return (" + parts[parts.length - 1] + ");"; return eval("(()=>{" + body + "})()"); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 600), rnd = mul(seed);
  const num = () => Math.floor(rnd() * 100);
  const program = () => {
    const k = rnd();
    if (k < 0.2) return `parseInt(${JSON.stringify(String(num()))})`;                         // parseInt of a numeric string
    if (k < 0.38) return `parseInt(${JSON.stringify(String(num()))})+${num()}`;               // parseInt into arithmetic
    if (k < 0.52) return `Number(${JSON.stringify(String(num()))})*${1 + Math.floor(rnd() * 5)}`; // Number into arithmetic
    if (k < 0.68) return `String(${num()})`;                                                  // String of a number
    if (k < 0.82) return `String(${num()})+${JSON.stringify("x")}`;                           // String into concat
    if (k < 0.92) return `Boolean(${Math.floor(rnd() * 3)})`;                                 // Boolean truthiness (0..2)
    const x = num(); return `let x=${JSON.stringify(String(x))};parseInt(x)+1`;               // variable argument
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = nodeRun(p); } catch { continue; }
    ref = String(ref);
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-globals: ${checked} global-function programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL jsint-globals: " + f); process.exit(1); }
