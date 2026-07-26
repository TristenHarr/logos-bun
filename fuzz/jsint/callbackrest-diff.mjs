// fuzz/jsint/callbackrest — a REST parameter in an array-method callback gathers the full (value, index,
// array) argument list: `[1,2,3].map((...a)=>a.length)` -> [3,3,3], `(x,...rest)=>` binds x=value and
// rest=[index,array]. callFnIdx/callFnIdx3/callFnIdxEnv3 previously bound only positionally so a rest
// param captured just the value. Fixed by routing a rest-param callback through bindParams with the
// gathered args. 1/2/3-param and destructuring callbacks are regression controls. Diffed vs Node.
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "cr-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const arr = () => "[" + Array.from({ length: 1 + ri(4) }, () => ri(20)).join(",") + "]";
  const program = () => {
    const k = ri(10);
    if (k === 0) return `console.log(${arr()}.map((...a)=>a.length).join(","))`;
    if (k === 1) return `console.log(${arr()}.map((...a)=>a[0]*2).join(","))`;
    if (k === 2) return `console.log(${arr()}.map((...a)=>a[1]).join(","))`;                          // index via rest
    if (k === 3) return `console.log(${arr()}.map((x,...rest)=>x+rest.length).join(","))`;
    if (k === 4) return `console.log(${arr()}.filter((...a)=>a[0]%2===0).join(","))`;
    if (k === 5) return `let out=[];${arr()}.forEach((...a)=>out.push(a.length));console.log(out.join(","))`;
    if (k === 6) return `let sum=0;${arr()}.forEach((x,...r)=>sum+=x);console.log(sum)`;
    // regression controls
    if (k === 7) return `console.log(${arr()}.map(x=>x*2).join(","))`;
    if (k === 8) return `console.log(${arr()}.map((x,i)=>i+":"+x).join(","))`;
    return `console.log(${arr()}.map((x,i,ar)=>x+ar.length).join(","))`;
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
  if (!fails.length) console.log(`PASS jsint-callbackrest: ${checked} callback-rest programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-callbackrest: " + f); process.exit(1); }
