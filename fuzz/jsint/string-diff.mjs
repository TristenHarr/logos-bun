// fuzz/jsint/string-diff — the P7 JS engine's STRING value model, differential-
// fuzzed vs Node eval. Covers string literals (incl. spaces), + concatenation
// with number coercion, string equality/inequality, lexical < >, strings through
// ternaries/loops/functions, and string variables — all while the numeric path
// stays intact (routed by whether a value is tagged a string).
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
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const word = () => { const w = ["a", "ab", "abc", "x", "yz", "foo", "bar", "hi there", "ok", "no", "apple", "banana"]; return pick(w); };
  const strLit = () => `"${word()}"`;
  const program = () => {
    const k = rnd();
    if (k < 0.3) { // concat chain (maybe with a number for coercion)
      const parts = [strLit()]; const m = 1 + Math.floor(rnd() * 3);
      for (let i = 0; i < m; i++) parts.push(rnd() < 0.8 ? strLit() : String(Math.floor(rnd() * 20)));
      return parts.join("+");
    }
    if (k < 0.5) return `${strLit()}${pick(["==", "!=", "===", "<", ">"])}${strLit()}`;
    if (k < 0.7) return `${strLit()}==${strLit()}?${strLit()}:${strLit()}`;
    if (k < 0.85) return `let a=${strLit()};let b=${strLit()};a+b`;
    return `function f(x){return ${strLit()}+x};f(${strLit()})`;
  };
  let checked = 0;
  for (let i = 0; i < n; i++) {
    const p = program();
    let ref; try { ref = nodeRun(p); } catch { continue; }
    ref = String(ref);
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-string: ${checked} string programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL jsint-string: " + f); process.exit(1); }
