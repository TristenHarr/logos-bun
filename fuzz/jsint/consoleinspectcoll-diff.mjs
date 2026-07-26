// fuzz/jsint/consoleinspectcoll — console.log of a Set / Map / Date uses Node's util.inspect form:
// `Set(n) { v, v }`, `Map(n) { k => v, k => v }`, empty `Set(0) {}` / `Map(0) {}`, and a Date as its ISO
// string (`1970-01-01T00:00:00.000Z`), with values/keys in the nested inspect form (strings single-quoted)
// and nesting (a Set/Date inside an array / as an object value). inspectVal now routes isSet/isMap to
// inspectSet/inspectMap and isDateObj to the ISO string (all were materialize -> `[object Object]`).
// Regression control: spreading a Set then .join still yields the comma form. Programs are kept small so
// output stays single-line (Node's multi-line wrapping for large collections is out of scope, skipped).
// Diffed vs Node (`bun run`).
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dir = OURS ? mkdtempSync(join(tmpdir(), "cic-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const words = ["a", "b", "c", "hi", "ok", "x"];
  const intList = () => Array.from({ length: 1 + ri(4) }, () => ri(9));
  const strList = () => Array.from({ length: 1 + ri(3) }, () => JSON.stringify(words[ri(words.length)]));
  const program = () => {
    const k = ri(14);
    if (k === 11) return `console.log(new Date(${ri(2000000000) * 1000}))`;               // Date -> ISO
    if (k === 12) return `console.log([new Date(${ri(1000000) * 100000})])`;              // Date nested in array
    if (k === 13) return `console.log({t:new Date(${ri(1000000) * 100000})})`;            // Date as object value
    if (k === 0) return `console.log(new Set([${intList().join(",")}]))`;
    if (k === 1) return `console.log(new Set([${strList().join(",")}]))`;
    if (k === 2) return `console.log(new Set())`;
    if (k === 3) { const a = ri(9), b = ri(9); return `console.log(new Set([${a},${a},${b}]))`; }  // dedup
    if (k === 4) { const m = 1 + ri(3); const parts = []; const seen = new Set(); for (let i = 0; i < m; i++) { let key = words[ri(words.length)]; while (seen.has(key)) key = words[ri(words.length)]; seen.add(key); parts.push(`[${JSON.stringify(key)},${ri(20)}]`); } return `console.log(new Map([${parts.join(",")}]))`; }
    if (k === 5) { const a = ri(9), b = ri(9); return `console.log(new Map([[${a},${a * 10}],[${b + 10},${b}]]))`; }  // int keys
    if (k === 6) return `console.log(new Map())`;
    if (k === 7) return `console.log([new Set([${intList().join(",")}])])`;                          // nested in array
    if (k === 8) return `console.log({s:new Set([${intList().join(",")}])})`;                        // as object value
    if (k === 9) return `console.log(new Set(${JSON.stringify(words[ri(words.length)] + words[ri(words.length)])}))`; // set from string
    // regression control: spread + join is the comma form, NOT inspect
    return `console.log([...new Set([${intList().join(",")}])].join(","))`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    const ref = runFile("node", p);
    if (ref.includes("\n")) continue;  // Node wrapped it multi-line — out of scope
    const got = runFile(OURS, p);
    if (got !== ref) fails.push(`run(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  rmSync(dir, { recursive: true, force: true });
  if (!fails.length) console.log(`PASS jsint-consoleinspectcoll: ${checked} Set/Map inspect programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-consoleinspectcoll: " + f); process.exit(1); }
