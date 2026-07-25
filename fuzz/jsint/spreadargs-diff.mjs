// fuzz/jsint/spreadargs — spread into a BUILTIN's argument list. Math.max/min already rode
// expandSpreadArgs, but String.fromCharCode / String.fromCodePoint went straight through splitArgsN
// (spread → empty) and Array/String .concat evaluated `...[[4],[5]]` as one NaN arg instead of
// expanding it. Both now wrap their arg text in expandSpreadArgs before splitArgsN. Exercises
// all-spread, mixed spread+literal, string spread, and array-of-arrays concat spread; plain literal
// arg lists are regressions. Diffed vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const run = (p) => { const r = spawnSync(OURS, ["__js", p], { encoding: "utf8" }); return r.status !== 0 ? `ERR:${r.status}` : (r.stdout || "").replace(/\n$/, ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const codes = () => Array.from({ length: 1 + ri(5) }, () => 65 + ri(26));
  const arrs = () => Array.from({ length: 1 + ri(3) }, () => Array.from({ length: 1 + ri(3) }, () => ri(20)));
  const program = () => {
    const k = ri(9);
    if (k === 0) return `String.fromCharCode(...[${codes()}])`;
    if (k === 1) { const c = codes(); return `String.fromCharCode(${c[0]},...[${c.slice(1)}])`; }
    if (k === 2) return `String.fromCodePoint(...[${codes()}])`;
    if (k === 3) { const a = arrs(); return `[${ri(10)},${ri(10)}].concat(...${JSON.stringify(a)}).join(",")`; }
    if (k === 4) { const a = arrs(); return `[].concat(...${JSON.stringify(a)}).length`; }
    if (k === 5) { const a = arrs(); return `[9].concat([1],...${JSON.stringify(a)},[2]).join("-")`; }
    if (k === 6) return `"x".concat(..."${"abc".slice(0, 1 + ri(3))}")`;
    if (k === 7) return `String.fromCharCode(${codes()})`;                       // regression: plain
    return `[1,2].concat([3],[4]).join(",")`;                                    // regression: plain concat
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-spreadargs: ${checked} spread-into-builtin-args programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-spreadargs: " + f); process.exit(1); }
