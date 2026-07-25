// fuzz/jsint/staticmut — MUTATION of a static class field (C.count++, C.total+=x, C.n=v) from a
// constructor or static method, in RUN (file) mode. Static fields were per-call env scalars, so a write
// inside a method/ctor was lost (C.count stayed at its initializer). Each class now also creates a
// per-class static heap object `__staticobj_<C>`; a static-field WRITE routes to it (objSet → persists)
// and a READ checks it before the initializer binding. Static reads / methods / getters (regressions)
// unchanged. Diffed vs Node via a module file (`bun run`).
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "sm-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = 1 + ri(5), b = 1 + ri(9), k = ri(7);
    if (k === 0) return `class C{static count=0;constructor(){C.count++}}${"new C();".repeat(a)}console.log(C.count)`;
    if (k === 1) return `class C{static n=0;static inc(){C.n++}}${"C.inc();".repeat(a)}console.log(C.n)`;
    if (k === 2) return `class C{static total=0;static add(x){C.total+=x}}C.add(${b});C.add(${a});console.log(C.total)`;
    if (k === 3) return `class C{static v=${b};static reset(){C.v=0}}C.reset();console.log(C.v)`;
    if (k === 4) return `class C{static items=[];static push(x){C.items.push(x)}}${Array.from({length:a},(_,i)=>`C.push(${i});`).join("")}console.log(C.items.join(","))`;
    if (k === 5) return `class C{static x=${a};static y=${b}}console.log(C.x+C.y)`;         // regression: read
    return `class C{static make(){return ${a}+${b}}}console.log(C.make())`;                 // regression: method
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
  if (!fails.length) console.log(`PASS jsint-staticmut: ${checked} static-mutation programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-staticmut: " + f); process.exit(1); }
