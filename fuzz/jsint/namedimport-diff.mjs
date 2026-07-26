// fuzz/jsint/namedimport — NAMED imports from builtin modules: `import { join } from "path"`,
// `import { format } from "util"`, `import { strictEqual, ok } from "assert"` (incl. `as` renames).
// Each named binding is a callable fn-marker (<tagStr>__nodemodfn:mod:method) that resolveCalls routes
// to nodeModCall — so a bare call like `join(a,b)` dispatches without the `path.` prefix. Default and
// namespace imports of the same modules are regression controls. path/util cases compare stdout;
// assert cases compare stdout + pass/fail exit. Diffed vs Node in a temp dir.
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
const run = (bin, dir, args) => { const r = spawnSync(bin, args, { encoding: "utf8", cwd: dir, timeout: 5000 }); return { out: (r.stdout || "").trim(), failed: (r.status || 0) !== 0 }; };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = 1 + ri(9), b = 1 + ri(9), k = ri(10);
    if (k === 0) return `import { join } from "path";\nconsole.log(join("a", "b${a}", "c"));`;
    if (k === 1) return `import { basename, extname } from "path";\nconsole.log(basename("/x/y${a}.js") + "|" + extname("z.tar.gz"));`;
    if (k === 2) return `import { dirname, isAbsolute } from "path";\nconsole.log(dirname("/a/b/c") + "|" + isAbsolute("/x"));`;
    if (k === 3) return `import { join as j } from "path";\nconsole.log(j("p${a}", "q"));`;
    if (k === 4) return `import { format } from "util";\nconsole.log(format("%s=%d", "n", ${a}));`;
    if (k === 5) return `import { inspect } from "util";\nconsole.log(inspect({v:${a}, w:[${a},${b}]}));`;
    if (k === 6) return `import { strictEqual, ok } from "assert";\nstrictEqual(${a}, ${a});\nok(${a} > 0);\nconsole.log("np");`;
    if (k === 7) return `import { strictEqual } from "assert";\nstrictEqual(${a}, ${a + 1});\nconsole.log("x");`;   // fails
    if (k === 8) return `import p from "path";\nconsole.log(p.join("a", "b"));`;                                   // default control
    return `import { relative } from "path";\nconsole.log(relative("/a/b/${a}", "/a/c/${b}"));`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "nif-"));
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got.out !== ref.out || got.failed !== ref.failed) fails.push(`${JSON.stringify(src)}: ours={out:${JSON.stringify(got.out)},failed:${got.failed}} node={out:${JSON.stringify(ref.out)},failed:${ref.failed}}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-namedimport: ${checked} named-import programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-namedimport: " + f); process.exit(1); }
