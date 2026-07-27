// fuzz/jsint/fnlength — a function's `.length` is its ARITY: the count of leading formal parameters
// before the first one that has a default (=) or is a rest (...), which JS excludes. Read off the
// function token's parameter list; hasOwnProperty("length") is true. Diffed vs Node. (Deferred: fn.name,
// and .length via a C.prototype.method chain — both need the function-metadata / method-value work.)
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
  const ps = (n) => Array.from({ length: n }, (_, i) => String.fromCharCode(97 + i)).join(", ");
  const program = () => {
    const a = ri(5), b = 1 + ri(4), k = ri(8);
    if (k === 0) return `function f(${ps(a)}){}\nconsole.log(f.length);`;
    if (k === 1) return `var g = function(${ps(b)}){};\nconsole.log(g.length);`;
    if (k === 2) return `var h = (${ps(b)}) => 0;\nconsole.log(h.length);`;
    if (k === 3) return `function d(${ps(a)}${a > 0 ? ", " : ""}z = 1, w) {}\nconsole.log(d.length);`;
    if (k === 4) return `function r(${ps(b)}, ...rest) {}\nconsole.log(r.length);`;
    if (k === 5) return `function q(${ps(a)}){}\nconsole.log(q.hasOwnProperty("length"), q.length);`;
    if (k === 6) return `var fns = [function(${ps(a)}){}, function(${ps(b)}){}];\nconsole.log(fns.map(function(fn){ return fn.length; }).join(","));`;
    return `function s(${ps(b)}){}\nconsole.log(typeof s.length, s.length + ${a});`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "fnlf-"));
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-fnlength: ${checked} function-arity programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-fnlength: " + f); process.exit(1); }
