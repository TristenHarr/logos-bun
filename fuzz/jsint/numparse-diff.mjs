// fuzz/jsint/numparse-diff — parseInt(str, radix) + Number(str) radix prefixes.
// parseInt parses the leading valid-digit run in the given base (2..36; radix 0/absent auto-
// detects 0x -> 16 else 10), tolerates leading whitespace + sign + trailing junk, NaN if no
// digit, NaN for radix <2 or >36. Number("0x..")/("0b..")/("0o..") parse the whole string in
// base 16/2/8. Random programs diffed vs Node.
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
  const digs = "0123456789abcdefghijklmnopqrstuvwxyz";
  const numInBase = (b) => { const len = 1 + ri(5); let s = ""; for (let i = 0; i < len; i++) s += digs[ri(b)]; return s; };
  const program = () => {
    const k = ri(8);
    if (k === 0) { const b = 2 + ri(35); return `parseInt("${numInBase(b)}",${b})`; }
    if (k === 1) return `parseInt("0x${numInBase(16)}")`;
    if (k === 2) { const s = numInBase(10); return `parseInt("${s}")`; }
    if (k === 3) { const s = numInBase(10); return `parseInt("  ${ri(2) ? "-" : ""}${s}zz",10)`; }
    if (k === 4) return `Number("0x${numInBase(16)}")`;
    if (k === 5) return `Number("0b${numInBase(2)}")`;
    if (k === 6) return `Number("0o${numInBase(8)}")`;
    return `parseInt("${numInBase(10)}",${ri(2) ? 1 : 40})`;   // out-of-range radix -> NaN
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
  if (!fails.length) console.log(`PASS jsint-numparse: ${checked} parseInt/Number programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-numparse: " + f); process.exit(1); }
