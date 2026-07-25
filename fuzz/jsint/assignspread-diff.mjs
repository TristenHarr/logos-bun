// fuzz/jsint/assignspread — Object.assign(target, ...sources) with SPREAD source arguments. objAssign
// split its arg list with patFields directly, so a `...arr` source contributed nothing and the merge
// dropped it (Object.assign({},...[{a:1}]) → {}). It now runs the arg text through expandSpreadArgs
// first — the same pipeline Math.max / String.fromCharCode / .concat use — so spread and plain object
// sources merge left-to-right (later keys win). Plain (non-spread) Object.assign is a regression check.
// Diffed vs Node (JSON.stringify of the merged object).
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
  const obj = (base) => `{${["a", "b", "c", "d"].slice(0, 1 + ri(3)).map((k, i) => `"${k}":${base + i}`).join(",")}}`;
  const program = () => {
    const k = ri(6), a = obj(1 + ri(9)), b = obj(1 + ri(9)), c = obj(1 + ri(9));
    if (k === 0) return `JSON.stringify(Object.assign({},...[${a},${b}]))`;
    if (k === 1) return `JSON.stringify(Object.assign(${a},...[${b}]))`;
    if (k === 2) return `JSON.stringify(Object.assign({},${a},...[${b},${c}]))`;
    if (k === 3) return `let s=[${a},${b}];JSON.stringify(Object.assign({},...s))`;
    if (k === 4) return `JSON.stringify(Object.assign({},${a},${b}))`;              // regression: plain
    return `const m=(...o)=>Object.assign({},...o);JSON.stringify(m(${a},${b},${c}))`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String((0, eval)(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-assignspread: ${checked} Object.assign-spread programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-assignspread: " + f); process.exit(1); }
