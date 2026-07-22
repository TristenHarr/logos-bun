// fuzz/jsint/module-diff — E6 ES modules: multi-file `import`/`export` executed through `bun run`.
// Each iteration writes a small random module GRAPH into a temp dir — leaf modules exporting consts
// / functions / classes / a default, mid modules that import-and-re-export or transform, and an entry
// that imports (named, default, `as` rename, `* as` namespace) and prints — then diffs stdout vs Node
// running the same files. Covers transitive chains, diamond-shared deps (evaluated once), and top-level
// side-effect ordering. Explicit `.js` extensions throughout (Node ESM requires them; Bun's
// extensionless resolution is a deliberate superset tested separately). The shared object heap makes an
// exported object/array a handle that stays live across the module boundary — exercised here too.
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
const run = (bin, dir, args) => { const r = spawnSync(bin, args, { encoding: "utf8", cwd: dir }); return ((r.stdout || "") + (r.status ? "\n<exit:" + r.status + ">" : "")).trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 120), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "modf-"));
    const a = 1 + ri(50), b = 1 + ri(50), c = 1 + ri(50);
    const shape = ri(6);
    let entry;
    if (shape === 0) {
      // named + default + const
      writeFileSync(join(dir, "leaf.js"), `export const K=${a};\nexport function f(x){return x+${b};}\nexport default function d(x){return x*${c};}\n`);
      entry = `import dfl, { K, f } from "./leaf.js";\nconsole.log(K + "," + f(10) + "," + dfl(3));\n`;
    } else if (shape === 1) {
      // transitive chain a -> b -> c
      writeFileSync(join(dir, "c.js"), `export const c=${a};\n`);
      writeFileSync(join(dir, "b.js"), `import { c } from "./c.js";\nexport const b=c*${b};\n`);
      entry = `import { b } from "./b.js";\nconsole.log(b);\n`;
    } else if (shape === 2) {
      // diamond, shared evaluated once (side-effect prints once)
      writeFileSync(join(dir, "s.js"), `console.log("S");\nexport const s=${a};\n`);
      writeFileSync(join(dir, "x.js"), `import { s } from "./s.js";\nexport const x=s+${b};\n`);
      writeFileSync(join(dir, "y.js"), `import { s } from "./s.js";\nexport const y=s+${c};\n`);
      entry = `import { x } from "./x.js";\nimport { y } from "./y.js";\nconsole.log(x + "-" + y);\n`;
    } else if (shape === 3) {
      // namespace import
      writeFileSync(join(dir, "ns.js"), `export const p=${a};\nexport const q=${b};\n`);
      entry = `import * as M from "./ns.js";\nconsole.log(M.p * M.q);\n`;
    } else if (shape === 4) {
      // re-export { as } from + export *
      writeFileSync(join(dir, "orig.js"), `export const u=${a};\nexport const v=${b};\n`);
      writeFileSync(join(dir, "mid.js"), `export { u as uu } from "./orig.js";\nexport * from "./orig.js";\nexport const w=${c};\n`);
      entry = `import { uu, v, w } from "./mid.js";\nconsole.log(uu + "," + v + "," + w);\n`;
    } else {
      // exported object/array crossing the boundary + method use
      writeFileSync(join(dir, "data.js"), `export const cfg={n:${a},m:${b}};\nexport const arr=[${a},${b},${c}];\n`);
      entry = `import { cfg, arr } from "./data.js";\nconsole.log(cfg.n + cfg.m + "|" + arr.map(x=>x+1).join("-"));\n`;
    }
    writeFileSync(join(dir, "entry.js"), entry);
    const ref = run(NODE, dir, ["entry.js"]);
    const got = run(OURS, dir, ["run", "entry.js"]);
    if (got !== ref) fails.push(`shape ${shape} (seed ${seed} it ${it}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-module: ${checked} module graphs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-module: " + f); process.exit(1); }
