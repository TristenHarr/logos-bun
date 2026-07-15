// fuzz/jsint/strmethod-diff — the P7 JS engine's STRING METHODS charAt / indexOf,
// differential-fuzzed vs Node eval. A resolveMethods pass runs BEFORE resolveCalls
// (which would otherwise eat the `(args)`), recognizing `<recv> . charAt (i)` and
// `<recv> . indexOf (sub)`: it evaluates the receiver and the argument through
// jsEvalIn, then dispatches — charAt returns the i-th char (chr(3) string, "" out
// of range), indexOf the first byte position or -1 (via substringBefore length).
// Covers literal + variable receivers, in-range + out-of-range charAt, found +
// not-found indexOf, and charAt results fed into string concat.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 600), rnd = mul(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const words = ["hello", "world", "banana", "abcdef", "mississippi", "logos"];
  const program = () => {
    const w = pick(words);
    const k = rnd();
    if (k < 0.25) { const i = Math.floor(rnd() * (w.length + 2)); return `${JSON.stringify(w)}.charAt(${i})`; }        // literal charAt (may be OOB)
    if (k < 0.5) { const i = Math.floor(rnd() * w.length); return `let s=${JSON.stringify(w)};s.charAt(${i})`; }       // variable charAt
    if (k < 0.55) { const sub = w.slice(Math.floor(rnd() * w.length), Math.floor(rnd() * w.length) + 1 + Math.floor(rnd() * 2)); return `${JSON.stringify(w)}.indexOf(${JSON.stringify(sub || w[0])})`; } // indexOf (found)
    if (k < 0.65) return `${JSON.stringify(w)}.indexOf(${JSON.stringify(pick(["zzz", "qq", "_"]))})`;                 // indexOf (not found → -1)
    if (k < 0.8) { const a = Math.floor(rnd() * w.length), b = a + 1 + Math.floor(rnd() * (w.length + 1 - a)); return `${JSON.stringify(w)}.slice(${a},${b})`; } // slice (b may exceed length)
    if (k < 0.9) return `${JSON.stringify(w)}.toUpperCase()`;                                                         // toUpperCase
    if (k < 0.96) return `${JSON.stringify(w.toUpperCase())}.toLowerCase()`;                                          // toLowerCase
    const i = Math.floor(rnd() * (w.length - 1)); return `let s=${JSON.stringify(w)};s.charAt(${i})+s.charAt(${i + 1})`; // charAt into concat
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
  if (!fails.length) console.log(`PASS jsint-strmethod: ${checked} string-method programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL jsint-strmethod: " + f); process.exit(1); }
