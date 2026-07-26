// fuzz/jsint/fsmod — node:fs synchronous reads: fs.readFileSync(path, "utf8"). The DRIVER (this Node
// harness) writes each random file into the temp dir; the program under test reads it back via both Node
// and ours and prints derived values (raw, .length, .split("\n").length, JSON.parse, concatenation of two
// files). Default import, `node:fs`, and named `{ readFileSync }` forms are exercised. We always pass the
// "utf8" encoding so both sides return a string (Node returns a Buffer without it). Diffed vs Node.
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
  const program = (files) => {
    const spec = ri(3) === 0 ? "node:fs" : "fs";
    const k = ri(7);
    if (k === 0) return `import fs from "${spec}";\nconsole.log(fs.readFileSync("a.txt", "utf8"));`;
    if (k === 1) return `import fs from "${spec}";\nconsole.log(fs.readFileSync("a.txt", "utf8").length);`;
    if (k === 2) return `import fs from "${spec}";\nconst j = JSON.parse(fs.readFileSync("j.json", "utf8"));\nconsole.log(j.a, j.name, j.b[1]);`;
    if (k === 3) return `import fs from "${spec}";\nconsole.log(fs.readFileSync("a.txt", "utf8").split("\\n").length);`;
    if (k === 4) return `import { readFileSync } from "${spec}";\nconsole.log(readFileSync("a.txt", "utf8").toUpperCase());`;
    if (k === 5) return `import fs from "${spec}";\nconsole.log(fs.readFileSync("a.txt", "utf8") + "|" + fs.readFileSync("b.txt", "utf8"));`;
    return `import fs from "${spec}";\nconst s = fs.readFileSync("a.txt", "utf8").trim();\nconsole.log(s === "" ? "EMPTY" : s.split("\\n")[0]);`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "fsf-"));
    writeFileSync(join(dir, "a.txt"), textContent());
    writeFileSync(join(dir, "b.txt"), textContent());
    writeFileSync(join(dir, "j.json"), jsonContent());
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-fsmod: ${checked} node:fs readFileSync programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-fsmod: " + f); process.exit(1); }
