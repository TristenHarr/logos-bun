// fuzz/jsint/pathmod — the node:path builtin module (POSIX): join/normalize/basename/dirname/extname/
// isAbsolute + sep/delimiter, imported via `import p from "path"` (and "node:path"). This is the first
// node-builtin-module: a tagStr `__nodemod:path` marker is bound for the import, resolveMethods routes
// `p.method(args)` to the pure path functions, and resolveObjDot serves data props. The import statement
// is on its OWN line (single-line `import …; stmt;` is a separate line-granularity limitation). Diffed vs
// Node in a temp dir.
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
  const seg = () => ["a", "b", "src", "dist", "..", ".", "x.js", "y.txt", "z", "app.mjs"][ri(10)];
  const segs = () => Array.from({ length: 1 + ri(4) }, seg);
  const apath = () => (ri(2) ? "/" : "") + segs().join("/") + (ri(4) === 0 ? "/" : "");
  const program = () => {
    const spec = ri(3) === 0 ? "node:path" : "path";
    const head = `import p from "${spec}";\n`;
    const k = ri(10);
    if (k === 9) return head + `console.log(p.relative(${JSON.stringify("/" + segs().join("/"))}, ${JSON.stringify("/" + segs().join("/"))}));`;
    if (k === 0) return head + `console.log(p.join(${segs().map((s) => JSON.stringify(s)).join(",")}));`;
    if (k === 1) return head + `console.log(p.normalize(${JSON.stringify(apath())}));`;
    if (k === 2) return head + `console.log(p.basename(${JSON.stringify(apath())}));`;
    if (k === 3) return head + `console.log(p.basename(${JSON.stringify(apath() + ".js")}, ".js"));`;
    if (k === 4) return head + `console.log(p.dirname(${JSON.stringify(apath())}));`;
    if (k === 5) return head + `console.log(JSON.stringify(p.extname(${JSON.stringify(apath())})));`;
    if (k === 6) return head + `console.log(p.isAbsolute(${JSON.stringify(apath())}));`;
    if (k === 7) return head + `console.log(p.sep + "|" + p.delimiter);`;
    return head + `const f = ${JSON.stringify("/" + segs().join("/"))};\nconsole.log(p.basename(f) + "@" + p.dirname(f));`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "pmf-"));
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-pathmod: ${checked} node:path programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-pathmod: " + f); process.exit(1); }
