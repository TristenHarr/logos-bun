// fuzz/jsint/assertmod — the node:assert builtin module (comparison assertions): ok, equal, strictEqual,
// notEqual, notStrictEqual, deepEqual, deepStrictEqual. A passing assertion is a no-op (the program
// continues and prints); a failing one throws an AssertionError that exits non-zero. Implemented by
// re-evaluating the equivalent ===/==/!==/!= expression (deep* via JSON.stringify). Reuses the
// node-builtin-module foundation. The AssertionError message differs from Node's, so this compares
// STDOUT + whether the exit is zero-vs-nonzero (the pass/fail signal), not the exact error text.
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
// compare stdout AND the pass/fail signal (exit 0 vs non-0)
const run = (bin, dir, args) => { const r = spawnSync(bin, args, { encoding: "utf8", cwd: dir, timeout: 5000 }); return { out: (r.stdout || "").trim(), failed: (r.status || 0) !== 0 }; };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const val = () => ["" + ri(9), '"s' + ri(9) + '"', ri(2) ? "true" : "false"][ri(3)];
  const program = () => {
    const head = `import a from "${ri(3) === 0 ? "node:assert" : "assert"}";\n`;
    const v1 = val(), v2 = val(), k = ri(9);
    if (k === 0) return head + `a.strictEqual(${v1}, ${v2});\nconsole.log("after");`;
    if (k === 1) return head + `a.equal(${v1}, ${v2});\nconsole.log("after");`;
    if (k === 2) return head + `a.notStrictEqual(${v1}, ${v2});\nconsole.log("after");`;
    if (k === 3) return head + `a.notEqual(${v1}, ${v2});\nconsole.log("after");`;
    if (k === 4) return head + `a.ok(${ri(2) ? v1 : ri(9)});\nconsole.log("after");`;
    if (k === 5) return head + `a.deepStrictEqual([${ri(9)},${ri(9)}], [${ri(9)},${ri(9)}]);\nconsole.log("after");`;
    if (k === 6) return head + `a.strictEqual(${1 + ri(5)} + ${1 + ri(5)}, ${2 + ri(9)});\nconsole.log("after");`;
    if (k === 7) return head + `a.deepEqual({x:${ri(5)}}, {x:${ri(5)}});\nconsole.log("after");`;
    return head + `a.ok(${v1} === ${v2});\nconsole.log("done" + ${ri(9)});`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "asf-"));
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got.out !== ref.out || got.failed !== ref.failed) fails.push(`${JSON.stringify(src)}: ours={out:${JSON.stringify(got.out)},failed:${got.failed}} node={out:${JSON.stringify(ref.out)},failed:${ref.failed}}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-assertmod: ${checked} node:assert programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-assertmod: " + f); process.exit(1); }
