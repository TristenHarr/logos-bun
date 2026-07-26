// fuzz/jsint/fsdir — node:fs directory ops: readdirSync (sorted array of names), mkdirSync (single-level
// and {recursive:true}), rmSync/rmdirSync. Each engine runs in its OWN seeded temp dir (these mutate the
// filesystem, so side effects must not leak between the Node and ours runs). readdirSync's order is
// normalized by .sort() on both sides. Deferred: non-recursive mkdir of a missing-parent path (Node throws
// ENOENT; ours creates it), Dirent objects, withFileTypes. Diffed vs Node.
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
  const fname = () => ["a.txt", "b.js", "c.json", "d.md", "e.log", "readme", "z9"][ri(7)];
  const program = () => {
    const k = ri(7), d = "dir" + ri(9);
    if (k === 0) return `import fs from "fs";\nconsole.log(fs.readdirSync(".").sort().join(","));`;
    if (k === 1) return `import fs from "fs";\nconsole.log(fs.readdirSync(".").length);`;
    if (k === 2) return `import fs from "fs";\nfs.mkdirSync(${JSON.stringify(d)});\nconsole.log(fs.existsSync(${JSON.stringify(d)}));`;
    if (k === 3) return `import fs from "fs";\nfs.mkdirSync("x/y/z", { recursive: true });\nconsole.log(fs.existsSync("x/y/z"), fs.existsSync("x/y"));`;
    if (k === 4) return `import fs from "fs";\nfs.mkdirSync(${JSON.stringify(d)});\nfs.writeFileSync(${JSON.stringify(d + "/f.txt")}, "hi");\nconsole.log(fs.readdirSync(${JSON.stringify(d)}).join(","));`;
    if (k === 5) return `import fs from "fs";\nfs.mkdirSync("tmp1", { recursive: true });\nfs.writeFileSync("tmp1/a", "x");\nfs.rmSync("tmp1", { recursive: true });\nconsole.log(fs.existsSync("tmp1"));`;
    return `import { readdirSync } from "fs";\nconsole.log(readdirSync(".").filter((f) => f.indexOf(".") >= 0).sort().join("|"));`;
  };
  const seedFiles = (dir) => { const m = 1 + ri(4); const set = new Set(); for (let j = 0; j < m; j++) set.add(fname()); for (const f of set) writeFileSync(join(dir, f), "seed"); return set; };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dirN = mkdtempSync(join(tmpdir(), "fdn-"));
    const dirO = mkdtempSync(join(tmpdir(), "fdo-"));
    const files = seedFiles(dirN);
    for (const f of files) writeFileSync(join(dirO, f), "seed");
    const src = program();
    // both dirs get BOTH script files so readdirSync(".") sees an identical file set
    writeFileSync(join(dirN, "e.mjs"), src); writeFileSync(join(dirN, "e.js"), src);
    writeFileSync(join(dirO, "e.mjs"), src); writeFileSync(join(dirO, "e.js"), src);
    const ref = run(NODE, dirN, ["e.mjs"]);
    const got = run(OURS, dirO, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dirN, { recursive: true, force: true });
    rmSync(dirO, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-fsdir: ${checked} fs directory-op programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-fsdir: " + f); process.exit(1); }
