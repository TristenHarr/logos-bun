// fuzz/jsint/urlmod — the node:url module's ESM essentials: fileURLToPath("file:///a/b") -> "/a/b",
// pathToFileURL("/a/b") -> a URL whose .href is "file:///a/b", and the named `URL` export (which works via
// the textual `new URL` intercept). Also the ubiquitous `__filename = fileURLToPath(...)` + path.dirname
// idiom. Default, node:url, and named import forms. Percent-decoding, UNC/file://host, and the legacy
// url.parse object API are deferred. Diffed vs Node in a temp dir.
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
  const seg = () => ["home", "x", "proj", "src", "a.js", "index.mjs", "lib", "y", "app"][ri(9)];
  const path = () => "/" + Array.from({ length: 1 + ri(4) }, seg).join("/");
  const program = () => {
    const spec = ri(3) === 0 ? "node:url" : "url";
    const p = path(), k = ri(6);
    if (k === 0) return `import { fileURLToPath } from "${spec}";\nconsole.log(fileURLToPath("file://${p}"));`;
    if (k === 1) return `import { pathToFileURL } from "${spec}";\nconsole.log(pathToFileURL(${JSON.stringify(p)}).href);`;
    if (k === 2) return `import url from "${spec}";\nconsole.log(url.fileURLToPath("file://${p}") + "|" + url.pathToFileURL(${JSON.stringify(p)}).href);`;
    if (k === 3) return `import { URL } from "${spec}";\nconst u = new URL("https://ex.com${p}?q=1");\nconsole.log(u.hostname + u.pathname + u.search);`;
    if (k === 4) return `import { fileURLToPath } from "${spec}";\nimport { dirname, basename } from "path";\nconst f = fileURLToPath("file://${p}");\nconsole.log(basename(f) + " @ " + dirname(f));`;
    return `import { pathToFileURL } from "${spec}";\nconst u = pathToFileURL(${JSON.stringify(p)});\nconsole.log(u.protocol, u.pathname);`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "umf-"));
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-urlmod: ${checked} node:url programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-urlmod: " + f); process.exit(1); }
