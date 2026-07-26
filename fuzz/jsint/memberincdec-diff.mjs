// fuzz/jsint/memberincdec — member increment/decrement in EXPRESSION position: ++o.n / o.n++ / ++a[i] /
// a[i]++ / --o.n / o.a.b++ where the pre/post value is USED (return, console.log arg, binary expr). These
// returned NaN and did not mutate (only the statement form o.n++ ; worked); now the incDec two-pass handles
// member targets (assignTarget in incDecEnv, value substitution in incDecRewrite). Regular object/array
// members only — static class fields (their own storage) and the double-same-member ordering quirk
// (shared with scalars, e.g. `f(o.n, o.n++)`) are separate items. Diffed vs Node (`bun run`).
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "mid-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = ri(20), b = ri(20), k = ri(13);
    if (k === 0) return `const o={n:${a}};console.log(++o.n,o.n)`;
    if (k === 1) return `const o={n:${a}};console.log(o.n++,o.n)`;
    if (k === 2) return `const o={n:${a}};console.log(--o.n,o.n)`;
    if (k === 3) return `const o={n:${a}};console.log(o.n--,o.n)`;
    if (k === 4) return `const arr=[${a},${b}];console.log(++arr[0],arr[0])`;
    if (k === 5) return `const arr=[${a},${b}];console.log(arr[1]++,arr[1])`;
    if (k === 6) return `const o={a:{b:${a}}};console.log(o.a.b++,o.a.b)`;
    if (k === 7) return `const o={n:${a}};const x=o.n++;console.log(x,o.n)`;
    if (k === 8) return `const o={c:0};for(let i=0;i<${1 + ri(5)};i++)o.c++;console.log(o.c)`;
    if (k === 9) return `const arr=[${a},${b},${a + b}];let i=${ri(3)};console.log(arr[i]++,arr[i])`;
    if (k === 10) return `class C{constructor(){this.n=${a}}bump(){return this.n++}}const c=new C();console.log(c.bump(),c.bump(),c.n)`;
    // static class field increment IN EXPRESSION position (id-generator / counter pattern)
    if (k === 11) return `class C{static c=${a};static next(){return ++C.c}}console.log(C.next(),C.next(),C.next())`;
    return `class C{static c=${a};static tick(){return C.c++}}console.log(C.tick(),C.tick(),C.c)`;
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
  if (!fails.length) console.log(`PASS jsint-memberincdec: ${checked} member-increment programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-memberincdec: " + f); process.exit(1); }
