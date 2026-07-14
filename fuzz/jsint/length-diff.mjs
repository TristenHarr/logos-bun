// fuzz/jsint/length-diff — the P7 JS engine's PROPERTY ACCESS `.length` on both
// arrays and strings, differential-fuzzed vs Node eval. `.` is now a tokenizer
// operator, so `x.length` splits to `x . length`; a resolveProps pass (after the
// array pass) reduces `<value> . length` to the element count (array) or char
// count (string). Covers literal + variable receivers, `.length` inside
// arithmetic / comparisons / ternaries, and the killer app: `.length` as a
// for-loop bound (the shape nearly every real array algorithm uses).
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
const nodeRun = (p) => { const parts = p.split(";"); const body = parts.slice(0, -1).map((s) => s + ";").join("") + " return (" + parts[parts.length - 1] + ");"; return eval("(()=>{" + body + "})()"); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 700), rnd = mul(seed);
  const words = ["a", "ab", "abc", "hello", "hi there", "logos", "the bun", "x y z"];
  const arr = () => { const len = 1 + Math.floor(rnd() * 5); return "[" + Array.from({ length: len }, () => Math.floor(rnd() * 30)).join(",") + "]"; };
  const str = () => `"${words[Math.floor(rnd() * words.length)]}"`;
  const program = () => {
    const k = rnd();
    if (k < 0.15) return `${arr()}.length`;                                        // array literal .length
    if (k < 0.30) return `${str()}.length`;                                        // string literal .length
    if (k < 0.45) return `let a=${arr()};a.length`;                                // variable array
    if (k < 0.55) return `let s=${str()};s.length`;                                // variable string
    if (k < 0.70) return `let a=${arr()};a.length+${Math.floor(rnd() * 10)}`;      // in arithmetic
    if (k < 0.82) return `let a=${arr()};a.length>${Math.floor(rnd() * 6)}?100:200`; // in comparison/ternary
    return `let a=${arr()};let s=0;for(let i=0;i<a.length;i=i+1){s=s+a[i]};s`;      // .length as loop bound
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = nodeRun(p); } catch { continue; }
    if (typeof ref === "number" && (!Number.isInteger(ref) || Math.abs(ref) > 1e15)) continue;
    ref = String(ref);
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-length: ${checked} .length programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL jsint-length: " + f); process.exit(1); }
