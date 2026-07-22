// fuzz/jsint/generator-diff — generators (E3). The engine has no coroutines, so a `function*`
// body is run once and every yielded value eagerly collected; the generator object then serves
// them to .next() ({value,done}), for-of, and spread. Covers fixed yields, loop-driven yields,
// exhaustion (done), for-of iteration, and spread into an array. Whole programs run through
// `bun run` and diffed (stdout) vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const NODE = process.execPath;
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dir = mkdtempSync(join(tmpdir(), "gdiff-"));
const runFile = (bin, src) => { const f = join(dir, "g.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const sn = () => 1 + ri(9);
  const program = () => {
    const k = ri(6), a = sn(), b = sn(), c = sn(), m = 2 + ri(5);
    if (k === 0) return `function* g(){yield ${a};yield ${b};yield ${c}};let it=g();console.log(it.next().value);console.log(it.next().value);`;
    if (k === 1) return `function* g(){yield ${a};yield ${b}};let it=g();console.log(it.next().value);console.log(it.next().value);console.log(it.next().done);`;
    if (k === 2) return `function* g(){yield ${a};yield ${b};yield ${c}};for(const x of g()){console.log(x)};`;
    if (k === 3) return `function* g(){yield ${a};yield ${b}};console.log([...g()].join(","));`;
    if (k === 4) return `function* range(n){let i=0;while(i<n){yield i;i=i+1}};console.log([...range(${m})].join(","));`;
    return `function* g(){yield ${a}*2;yield ${b}+1};let it=g();console.log(it.next().value+it.next().value);`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src);
    const got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-generator: ${checked} generator programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-generator: " + f); process.exit(1); }
