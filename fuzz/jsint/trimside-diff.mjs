// fuzz/jsint/trimside-diff — String.trimStart / String.trimEnd: one-sided whitespace
// trimming. trimStart drops only leading spaces (trailing + internal kept), trimEnd
// only trailing. Reuse the same trimHeadIdx/trimTailIdx scan as .trim (our spaces are
// encSpace end-to-end). Diffed vs Node. Marker order note: 'trim' is a prefix of
// 'trimStart'/'trimEnd' but position-order dispatch requires the name + ' (', so
// 'trim (' never matches 'trimStart ('.
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
const nodeRun = (p) => {
  let depth = 0, parts = [], cur = "";
  for (const c of p) { if (c === "{" || c === "(" || c === "[") depth++; else if (c === "}" || c === ")" || c === "]") depth--; if (c === ";" && depth === 0) { parts.push(cur); cur = ""; } else cur += c; }
  parts.push(cur);
  const body = parts.slice(0, -1).map((s) => s + ";").join("") + " return (" + parts[parts.length - 1] + ");";
  return eval("(()=>{" + body + "})()");
};
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const sp = (k) => " ".repeat(k);
  const word = () => ["hi", "a b", "left", "x y z", "bun", "logos"][ri(6)];
  const padded = () => `"${sp(ri(4))}${word()}${sp(ri(4))}"`;
  const fn = () => ["trimStart", "trimEnd", "trim"][ri(3)];
  const program = () => {
    const k = ri(4);
    if (k === 0) return `${padded()}.${fn()}()+"|"`;                       // bracket the result to expose kept spaces
    if (k === 1) return `${padded()}.${fn()}().length`;                    // length after trim
    if (k === 2) return `("|"+${padded()}.${fn()}()+"|")`;                 // both sides bracketed
    return `${padded()}.trimStart().trimEnd()+"|"`;                        // chain == trim
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = nodeRun(p); } catch { continue; }
    ref = String(ref);
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-trimside: ${checked} trimStart/trimEnd programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-trimside: " + f); process.exit(1); }
