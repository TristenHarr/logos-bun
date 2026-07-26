// fuzz/jsint/fsmod — node:fs synchronous file IO: readFileSync/writeFileSync/existsSync. The DRIVER
// seeds each engine's OWN temp dir with random files; the program under test reads them back and prints
// derived values (raw, .length, .split, JSON.parse, two-file concat), writes-then-reads a roundtrip,
// checks existsSync before/after a write, and hits ENOENT on a missing file (compared via the exit
// marker). Default, `node:fs`, and named `{ readFileSync, writeFileSync, existsSync }` forms are all
// exercised. readFileSync always gets "utf8" so both sides return a string (Node returns a Buffer
// otherwise). Node and ours run in SEPARATE dirs so write side effects never leak between them.
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
  const word = () => ["alpha", "beta", "gamma", "x1", "y2", "z3", "hello", "world", "42", "config"][ri(10)];
  const line = () => Array.from({ length: 1 + ri(4) }, word).join(" ");
  const textContent = () => Array.from({ length: 1 + ri(5) }, line).join("\n");
  const jsonContent = () => JSON.stringify({ a: ri(99), b: [ri(9), ri(9)], name: word() });
  const program = () => {
    const spec = ri(3) === 0 ? "node:fs" : "fs";
    const payload = JSON.stringify(line());
    const k = ri(15);
    if (k === 11) return `import fs from "${spec}";\nfs.writeFileSync("ap.txt", "start");\nfs.appendFileSync("ap.txt", ${payload});\nfs.appendFileSync("ap.txt", "END");\nconsole.log(fs.readFileSync("ap.txt", "utf8"));`;
    if (k === 12) return `import fs from "${spec}";\nfs.writeFileSync("src.txt", ${payload});\nfs.copyFileSync("src.txt", "dst.txt");\nconsole.log(fs.readFileSync("dst.txt", "utf8"), fs.existsSync("dst.txt"));`;
    if (k === 13) return `import fs from "${spec}";\nfs.writeFileSync("r1.txt", ${payload});\nfs.renameSync("r1.txt", "r2.txt");\nconsole.log(fs.existsSync("r1.txt"), fs.existsSync("r2.txt"), fs.readFileSync("r2.txt", "utf8"));`;
    if (k === 14) return `import fs from "${spec}";\nfs.writeFileSync("u.txt", ${payload});\nconsole.log(fs.existsSync("u.txt"));\nfs.unlinkSync("u.txt");\nconsole.log(fs.existsSync("u.txt"));`;
    if (k === 0) return `import fs from "${spec}";\nconsole.log(fs.readFileSync("a.txt", "utf8"));`;
    if (k === 1) return `import fs from "${spec}";\nconsole.log(fs.readFileSync("a.txt", "utf8").length);`;
    if (k === 2) return `import fs from "${spec}";\nconst j = JSON.parse(fs.readFileSync("j.json", "utf8"));\nconsole.log(j.a, j.name, j.b[1]);`;
    if (k === 3) return `import fs from "${spec}";\nconsole.log(fs.readFileSync("a.txt", "utf8").split("\\n").length);`;
    if (k === 4) return `import { readFileSync } from "${spec}";\nconsole.log(readFileSync("a.txt", "utf8").toUpperCase());`;
    if (k === 5) return `import fs from "${spec}";\nconsole.log(fs.readFileSync("a.txt", "utf8") + "|" + fs.readFileSync("b.txt", "utf8"));`;
    if (k === 6) return `import fs from "${spec}";\nfs.writeFileSync("out.txt", ${payload});\nconsole.log(fs.readFileSync("out.txt", "utf8"));`;   // write->read roundtrip
    if (k === 7) return `import fs from "${spec}";\nconst o = {v: ${ri(99)}, tag: ${payload}};\nfs.writeFileSync("o.json", JSON.stringify(o));\nconsole.log(JSON.parse(fs.readFileSync("o.json", "utf8")).v);`;
    if (k === 8) return `import fs from "${spec}";\nconsole.log(fs.existsSync("a.txt"), fs.existsSync("nope.txt"));`;
    if (k === 9) return `import { writeFileSync, existsSync } from "${spec}";\nconsole.log(existsSync("made.txt"));\nwriteFileSync("made.txt", ${payload});\nconsole.log(existsSync("made.txt"));`;
    return `import fs from "${spec}";\nconsole.log("before");\nconst s = fs.readFileSync("missing-${ri(999)}.txt", "utf8");\nconsole.log("after", s);`;    // ENOENT throw
  };
  // Each engine gets its OWN seeded dir: a program's writeFileSync side effects must not leak from the
  // Node run into ours (they'd share a file, e.g. existsSync-before-write would see the other's write).
  const seedDir = (dir, a, b, j) => { writeFileSync(join(dir, "a.txt"), a); writeFileSync(join(dir, "b.txt"), b); writeFileSync(join(dir, "j.json"), j); };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dirN = mkdtempSync(join(tmpdir(), "fsf-n-"));
    const dirO = mkdtempSync(join(tmpdir(), "fsf-o-"));
    const a = textContent(), b = textContent(), j = jsonContent();
    seedDir(dirN, a, b, j);
    seedDir(dirO, a, b, j);
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
  if (!fails.length) console.log(`PASS jsint-fsmod: ${checked} node:fs readFileSync programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-fsmod: " + f); process.exit(1); }
