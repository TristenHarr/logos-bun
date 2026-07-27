// fuzz/jsint/eval — the eval(string) builtin. A source string runs through the same normalize->run
// pipeline as a program and yields its completion value (last statement's value, undefined for a
// statement form). Direct eval reads the caller's bindings and mutates outer heap objects in place;
// eval of a non-string returns the argument unchanged. Diffed vs Node. (Deferred: tab/VT/FF as
// inter-token whitespace — chr9/chr12 are internal fn-encoding control bytes.)
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
  const program = () => {
    const a = 1 + ri(20), b = 1 + ri(20), k = ri(11);
    if (k === 0) return `console.log(eval("${a} + ${b}"));`;
    if (k === 1) return `console.log(eval("${a} * ${b} - ${a}"));`;
    if (k === 2) return `console.log(eval("var q = ${a}; q * ${b}"));`;
    if (k === 3) return `var v = ${a};\nconsole.log(eval("v + ${b}"));`;
    if (k === 4) return `console.log(${a} + eval("${b}") + ${a});`;
    if (k === 5) return `console.log(typeof eval("({z:${a}})"));`;
    if (k === 6) return `console.log(eval(${a}));`;
    if (k === 7) return `var arr = [];\neval("arr.push(${a}); arr.push(${b});");\nconsole.log(arr.join("-"));`;
    if (k === 8) return `console.log(eval("[${a},${b}].map(function(x){return x+1;}).join(',')"));`;
    if (k === 9) return `console.log(eval("(function(){ return ${a} + ${b}; })()"));`;
    return `console.log(eval("'r' + ${a}") + eval("'s' + ${b}"));`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "evf-"));
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-eval: ${checked} eval programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-eval: " + f); process.exit(1); }
