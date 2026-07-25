// fuzz/jsint/destructlength — object-destructuring the `length` off an array or string
// (const {length}=arr, const {length:n}=str, const {length=0}=arr). Arrays/strings have no stored
// `length` property, so the destructuring reader's plain objGet returned undefined; destructGet now
// computes propLength for an array/string `length` key. A real object's own `length` property, and all
// other destructuring (rename, defaults, rest, nested), are unaffected. Diffed vs Node (`bun run`).
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "dl-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const len = 1 + ri(6), k = ri(6);
    const arrLit = "[" + Array.from({ length: len }, (_, i) => i).join(",") + "]";
    if (k === 0) return `const nums=${arrLit};const{length}=nums;console.log(length)`;
    if (k === 1) return `const{length:n}=${arrLit};console.log(n)`;
    if (k === 2) return `const{length}=${JSON.stringify("x".repeat(len))};console.log(length)`;
    if (k === 3) return `const{a,b}={a:${ri(9)},b:${ri(9)}};console.log(a+b)`;                    // regression: object
    if (k === 4) return `const o={length:${ri(50)}};const{length}=o;console.log(length)`;          // regression: real length prop
    return `const{x=1,y=2}={x:${ri(9)}};console.log(x,y)`;                                          // regression: defaults
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
  if (!fails.length) console.log(`PASS jsint-destructlength: ${checked} destructure-length programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-destructlength: " + f); process.exit(1); }
