// fuzz/jsint/staticgetter — `static get NAME(){…}` on a class, read as `C.NAME`. classWalk treated
// `static get x` as a static method named "get"; it now emits a `__static_get_<C>_<x>` binding, and the
// static-property reader (resolveStaticProps) invokes that getter (zero args) on a `C.x` read. Covers
// numeric/string/computed getters, multiple getters, and a getter that reads a static field. Static
// fields and static methods (regressions) must be unchanged. Diffed vs Node via a module file.
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "sg-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = ri(50), b = ri(50), k = ri(6);
    if (k === 0) return `class C{static get val(){return ${a}}}console.log(C.val)`;
    if (k === 1) return `class C{static get name2(){return "n${a}"}}console.log(C.name2)`;
    if (k === 2) return `class M{static get A(){return ${a}}static get B(){return ${b}}}console.log(M.A+M.B)`;
    if (k === 3) return `class C{static get n(){return ${a}+${b}}}console.log(C.n*2)`;
    if (k === 4) return `class C{static BASE=${a};static get doubled(){return C.BASE*2}}console.log(C.doubled)`;
    return `class C{static v=${a};static make(){return C.v+${b}}}console.log(C.make())`;  // regression: field+method
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
  if (!fails.length) console.log(`PASS jsint-staticgetter: ${checked} static-getter programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-staticgetter: " + f); process.exit(1); }
