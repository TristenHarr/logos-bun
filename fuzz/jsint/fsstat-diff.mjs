// fuzz/jsint/fsstat — fs.statSync: the Stats object's .size (bytes), .isFile(), .isDirectory(), and the
// ENOENT throw on a missing path. The DRIVER writes each file (with known content so .size is exact) and
// makes directories; the program under test stats them via both engines. Node and ours run in SEPARATE
// seeded dirs (mkdir side effects). mtime and the other Stats members are deferred. Diffed vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from "node:fs";
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
  const content = () => "x".repeat(ri(50));
  const program = () => {
    const k = ri(6);
    if (k === 0) return `import fs from "fs";\nconst s = fs.statSync("data.txt");\nconsole.log(s.size, s.isFile(), s.isDirectory());`;
    if (k === 1) return `import fs from "fs";\nconst d = fs.statSync("adir");\nconsole.log(d.isFile(), d.isDirectory());`;
    if (k === 2) return `import fs from "fs";\nconsole.log(fs.statSync("data.txt").size + 100);`;
    if (k === 3) return `import { statSync } from "fs";\nconsole.log(statSync("data.txt").isFile() ? "F" : "?", statSync("adir").isDirectory() ? "D" : "?");`;
    if (k === 4) return `import fs from "fs";\nconsole.log("before");\nfs.statSync("missing-${ri(999)}");\nconsole.log("after");`;
    return `import fs from "fs";\nconst s = fs.statSync("data.txt");\nif (s.isFile() && s.size >= 0) { console.log("ok", s.size); } else { console.log("no"); }`;
  };
  const seed2 = (dir, body) => { writeFileSync(join(dir, "data.txt"), body); mkdirSync(join(dir, "adir")); };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dirN = mkdtempSync(join(tmpdir(), "fsn-"));
    const dirO = mkdtempSync(join(tmpdir(), "fso-"));
    const body = content();
    seed2(dirN, body); seed2(dirO, body);
    const src = program();
    writeFileSync(join(dirN, "e.mjs"), src);
    writeFileSync(join(dirO, "e.js"), src);
    const ref = run(NODE, dirN, ["e.mjs"]);
    const got = run(OURS, dirO, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dirN, { recursive: true, force: true });
    rmSync(dirO, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-fsstat: ${checked} fs.statSync programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-fsstat: " + f); process.exit(1); }
