// fuzz/jsint/runfile-diff — the PRODUCT surface: `bun run <file.js>` executes a real
// JavaScript file through the LOGOS jsint engine, with console.log printing to stdout
// (via the new puts native; the file is slurped via the new readFile native). Each
// generated program is written to a temp .js, run through `bun run file.js` AND Node,
// and the full stdout must match byte-for-byte. This is the end-to-end whole-program
// lock — not a single expression, a real multi-statement file with console.log output.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dir = mkdtempSync(join(tmpdir(), "runfile-"));
const ourRun = (file) => { const r = spawnSync(OURS, ["run", file], { encoding: "utf8" }); return r.status !== 0 ? `ERR:${r.status}` : `${r.stdout || ""}\x01${r.stderr || ""}`; };
const nodeRun = (file) => { const r = spawnSync("node", [file], { encoding: "utf8" }); return r.status !== 0 ? `NODEERR:${r.status}` : `${r.stdout || ""}\x01${r.stderr || ""}`; };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 120), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const sn = () => 1 + ri(9);
  const program = () => {
    // Compose a few statements, each producing deterministic console.log output over
    // primitives (strings/numbers) — where materialize() matches console.log's String().
    const lines = [];
    const k = ri(6);
    if (k === 0) { const a = sn(), b = sn(); lines.push(`console.log("a+b", ${a}+${b});`, `console.log("a*b", ${a}*${b});`); }
    else if (k === 1) { const arr = Array.from({ length: 3 + ri(4) }, () => sn()); lines.push(`let a=[${arr.join(",")}];`, `console.log("sorted", a.sort((x,y)=>x-y).join(","));`, `console.log("sum", a.reduce((s,x)=>s+x,0));`); }
    else if (k === 2) { const nm = ["ada", "grace", "linus"][ri(3)]; lines.push(`const o={name:"${nm}",n:${sn()}};`, "const {name,n}=o;", "console.log(`${name}=${n}`);"); }
    else if (k === 3) { const t = sn(); lines.push(`function f(x){return x<2?x:f(x-1)+f(x-2)}`, `console.log("fib", f(${1 + ri(8)}));`); }
    else if (k === 4) { const len = 2 + ri(4); lines.push(`let c={t:0};`, `for(let i=1;i<=${len};i++){c.t+=i}`, `console.log("tri", c.t);`); }
    else { const arr = Array.from({ length: 2 + ri(3) }, () => sn()); lines.push(`console.log([${arr.join(",")}].map((x,i)=>x+i).join("-"));`, `console.log("max", Math.max(...[${arr.join(",")}]));`); }
    // half the time, also emit to stderr (console.error/warn), locked via the \x01-joined stdout\x01stderr comparison
    if (ri(2) === 0) lines.push(`console.error("err", ${sn()});`, `console.warn("warn");`);
    return lines.join("\n") + "\n";
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const file = join(dir, `p${seed}_${it}.js`);
    writeFileSync(file, src);
    const ref = nodeRun(file);
    if (ref.startsWith("NODEERR")) continue;
    const got = ourRun(file);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-runfile: ${checked} whole-program files run identically to Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-runfile: " + f); process.exit(1); }
