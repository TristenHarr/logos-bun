// fuzz/jsint/processmod — the newly-added process.* surface: process.platform / process.arch (host
// constants via the os_platform/os_arch natives) and process.cwd() (the get_cwd native), plus the existing
// process.argv (array) and process.env access. Every value is deterministic on this host — process.cwd()
// is the temp dir the program runs in, so it must byte-match Node. Exercised at top level and inside
// (multi-line) functions. process.version/pid are deferred (no exact cross-runtime value). Diffed vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const NODE = "node";
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const run = (bin, dir, args) => { const r = spawnSync(bin, args, { encoding: "utf8", cwd: dir, timeout: 5000 }); return ((r.stdout || "") + (r.status ? "\n<exit:" + r.status + ">" : "")).trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const k = ri(8);
    if (k === 0) return `console.log(process.platform);`;
    if (k === 1) return `console.log(process.arch);`;
    if (k === 2) return `console.log(process.cwd());`;
    if (k === 3) return `console.log(process.platform + "-" + process.arch);`;
    if (k === 4) return `function info() {\n  return process.platform + " on " + process.cwd();\n}\nconsole.log(info());`;
    if (k === 5) return `console.log(Array.isArray(process.argv), process.cwd().length > 0);`;
    if (k === 6) return `const p = process.platform;\nif (p === "linux" || p === "darwin" || p === "win32") {\n  console.log("known:" + p);\n} else {\n  console.log("other");\n}`;
    return `console.log(process.cwd() === process.cwd(), typeof process.arch);`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "prf-"));
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-processmod: ${checked} process.* programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-processmod: " + f); process.exit(1); }
