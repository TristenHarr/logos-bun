// fuzz/jsint/uninitbox — an UNINITIALIZED declaration (let g;) that is captured and mutated in a
// closure (the declare-then-assign-in-a-callback pattern: let g; …on("x", d=>{g=d}); or
// let result; arr.forEach(n=>{ if(cond) result=n })). Boxing only promoted scalars with a LITERAL
// initializer, so `let g;` was left unboxed and the closure's write was lost (g stayed undefined).
// scalarDeclName/isDeclOf/boxDecl now handle an initializer-less simple-name declaration (boxed to
// {v: undefined}). Diffed vs Node (`bun run`). An initialized capture is the regression control.
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "ub-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = 1 + ri(20), b = 1 + ri(20), k = ri(6);
    if (k === 0) return `let g;const f=(d)=>{g=d};f(${a});console.log(g)`;
    if (k === 1) return `let result;[${Array.from({length:3+ri(3)},(_,i)=>i).join(",")}].forEach(n=>{if(n===${ri(3)})result=n});console.log(result)`;
    if (k === 2) return `let last;function set(d){last=d}set(${a});set(${b});console.log(last)`;
    if (k === 3) return `class E{constructor(){this.s={}}on(k,f){(this.s[k]=this.s[k]||[]).push(f)}emit(k,d){(this.s[k]||[]).forEach(f=>f(d))}}const e=new E();let g;e.on("x",d=>{g=d});e.emit("x",${a});console.log(g)`;
    if (k === 4) return `let acc;const add=n=>{acc=(acc||0)+n};add(${a});add(${b});console.log(acc)`;
    return `let g=0;const f=(d)=>{g=d};f(${a});console.log(g)`;   // regression: initialized capture
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
  if (!fails.length) console.log(`PASS jsint-uninitbox: ${checked} uninitialized-capture programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-uninitbox: " + f); process.exit(1); }
