// fuzz/jsint/nativefncb — a bare built-in function passed as a (single-arg) CALLBACK: `.then(console.log)`,
// `.then(Math.sqrt)`, `.map(Object.keys)`, `.map(Object.values)`, `.map(JSON.stringify)`, plus the coercion
// callbacks `.map(Number)`/`.filter(Boolean)`/`.map(String)`. isDottedBuiltinFn now recognizes any known
// builtin namespace.method (Math/Number/Object/JSON/Array/console/String/Date), synthGlobalCb wraps it as
// `(__cbx) => ns.method(__cbx)`, and fnArgVal (async .then/.catch) checks it too. (Multi-arg forEach(console.log)
// — passing idx/array — is a separate follow-up.) Arrow callbacks are regression controls. Diffed vs Node.
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "nc-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = 1 + ri(9), b = 1 + ri(9), k = ri(12);
    if (k === 0) return `Promise.resolve(${a}).then(console.log)`;
    if (k === 1) return `Promise.resolve(${a * a}).then(Math.sqrt).then(v=>console.log(v))`;
    if (k === 2) return `console.log([{x:${a}},{y:${b}}].map(Object.keys).map(kk=>kk[0]).join(","))`;
    if (k === 3) return `console.log([{x:${a}}].map(Object.values)[0][0])`;
    if (k === 4) return `console.log([{x:${a}},{y:${b}}].map(JSON.stringify).join("|"))`;
    if (k === 5) return `console.log(["${a}","${b}"].map(Number).reduce((x,y)=>x+y))`;
    if (k === 6) return `console.log([0,${a},"",${b}].filter(Boolean).join(","))`;
    if (k === 7) return `console.log([${a},${b}].map(String).join(","))`;
    if (k === 8) return `console.log([-${a},-${b}].map(Math.abs).join(","))`;
    if (k === 9) return `Promise.resolve("${a}").then(Number).then(v=>console.log(v+1))`;
    // arrow-callback controls
    if (k === 10) return `console.log([${a},${b}].map(x=>x*2).join(","))`;
    return `Promise.resolve(${a}).then(x=>console.log(x+1))`;
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
  if (!fails.length) console.log(`PASS jsint-nativefncb: ${checked} native-fn-callback programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-nativefncb: " + f); process.exit(1); }
