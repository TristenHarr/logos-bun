// fuzz/jsint/oneliner-diff — statements packed onto ONE line with no `;` between a block's closing
// `}` and the next statement (minified/terse source): function decl + call, for/while loop + trailing
// statement, if-block + trailing statement. splitTop now inserts a statement boundary after a depth-0
// `}` unless what follows continues the statement (else/catch/finally/while/operator/./end). The
// control-flow keyword continuations (if/else, try/catch) and object literals must NOT be split.
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
const dir = mkdtempSync(join(tmpdir(), "onel-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const sn = () => 1 + ri(6);
  const program = () => {
    const k = ri(6), a = sn(), b = sn();
    if (k === 0) return `function f(x){return x*${a};}console.log(f(${b}));`;
    if (k === 1) return `let t=0;for(let i=0;i<${a};i++){t=t+i;}console.log(t);`;
    if (k === 2) return `let n=${a};if(n>${b}){console.log("hi");}console.log(n);`;
    if (k === 3) return `let a=0;while(a<${a}){a=a+1;}console.log(a);`;
    if (k === 4) return `if(${a}>${b}){console.log("x");}else{console.log("y");}console.log("z");`;
    return `function g(){return ${a};}function h(){return ${b};}console.log(g()+h());`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src);
    const got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-oneliner: ${checked} packed one-line programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-oneliner: " + f); process.exit(1); }
