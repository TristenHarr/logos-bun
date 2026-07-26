// fuzz/jsint/builtintypeof — `typeof` of a bare built-in NAME: the global namespaces (Math/JSON/console/
// globalThis/Reflect) are "object", the constructors and global functions (Object/Array/Symbol/BigInt/
// parseInt/…) are "function". These names dispatch specially rather than living as heap values, so without
// a type table they fell through to NaN and misreported "number" — breaking `typeof Symbol !== "undefined"`
// style feature tests. A CALL (`typeof Math.floor(x)`), a PROPERTY (`typeof Math.PI`), and `.length` still
// resolve first and keep their real type — those are regression controls. (typeof of a bare builtin METHOD
// like `Math.floor`/`arr.push` needs native-methods-as-values and is a separate gap, not exercised here.)
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "bt-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const OBJS = ["Math", "JSON", "console", "globalThis", "Reflect"];
  const FNS = ["Object", "Array", "String", "Number", "Boolean", "Symbol", "BigInt", "Promise", "Map", "Set", "RegExp", "Error", "TypeError", "parseInt", "parseFloat", "isNaN", "Date", "Function"];
  const bi = () => (ri(2) ? FNS[ri(FNS.length)] : OBJS[ri(OBJS.length)]);
  const program = () => {
    const b = bi(), k = ri(8);
    if (k === 0) return `console.log(typeof ${b})`;
    if (k === 1) return `console.log(typeof ${b} === "${OBJS.includes(b) ? "object" : "function"}")`;
    if (k === 2) return `console.log(typeof ${OBJS[ri(OBJS.length)]}, typeof ${FNS[ri(FNS.length)]})`;
    if (k === 3) return `console.log(typeof Symbol !== "undefined", typeof BigInt === "function")`; // feature test
    // regression controls — resolve before typeof, keep real type
    if (k === 4) return `console.log(typeof Math.floor(${1 + ri(9)}.5))`;   // -> number
    if (k === 5) return `console.log(typeof Math.PI, typeof Math.E)`;        // -> number number
    if (k === 6) return `console.log(typeof JSON.stringify({a:${ri(9)}}))`;  // -> string
    return `console.log(typeof Array.isArray([${ri(3)}]))`;                  // -> boolean
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
  if (!fails.length) console.log(`PASS jsint-builtintypeof: ${checked} builtin-typeof programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-builtintypeof: " + f); process.exit(1); }
