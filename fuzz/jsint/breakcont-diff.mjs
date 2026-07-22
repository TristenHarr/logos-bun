// fuzz/jsint/breakcont-diff — break/continue (previously no-ops) and braceless `if (c) stmt` /
// `if (c) a; else b`. break/continue signal the loop via env flags that runBlock stops on and the
// loop clears (break stops, continue advances); the braceless-if consequent is a single statement,
// and splitTop keeps `; else` together. Covers for/while/for-of with break & continue, braceless
// if guarding break/continue, and braceless if/else chains. Diffed vs Node.
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
const dir = mkdtempSync(join(tmpdir(), "brk-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const k = ri(7), lim = 3 + ri(6), br = 1 + ri(lim), md = 2 + ri(3);
    if (k === 0) return `let r=[];for(let i=0;i<${lim};i++){if(i===${br})break;r.push(i);}console.log(r.join(","));`;
    if (k === 1) return `let r=[];for(let i=0;i<${lim};i++){if(i%${md}===0)continue;r.push(i);}console.log(r.join(","));`;
    if (k === 2) return `let i=0,s=0;while(i<${lim}){i++;if(i>${br})break;s+=i;}console.log(s);`;
    if (k === 3) return `let r=[];for(const x of [${Array.from({length: lim}, (_, j) => j).join(",")}]){if(x===${br})break;r.push(x);}console.log(r.join(","));`;
    if (k === 4) return `let x=${ri(10)};if(x>${5})console.log("big");else console.log("small");`;
    if (k === 5) return `let n=${ri(4)};if(n===0)console.log("z");else if(n===1)console.log("o");else console.log("m");`;
    return `let r=[];for(const x of [${Array.from({length: lim}, (_, j) => j).join(",")}]){if(x%${md}===0)continue;r.push(x);}console.log(r.join(","));`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src);
    const got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-breakcont: ${checked} break/continue/braceless-if programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-breakcont: " + f); process.exit(1); }
