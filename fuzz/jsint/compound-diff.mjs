// fuzz/jsint/compound-diff — the P7 JS engine's COMPOUND ASSIGNMENT (`+=`/`-=`/
// `*=`), differential-fuzzed vs Node eval. `+= -= *=` are now 2-char tokens
// (isOp2), desugared in execStmt to `x = x <op> rhs`. Covers bare updates,
// self-reference (x*=x), string concat via `+=`, and — the real workhorse —
// compound assignment inside for-loop updates AND bodies (accumulators).
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
  for (const c of p) {
    if (c === "{" || c === "(") depth++;
    else if (c === "}" || c === ")") depth--;
    if (c === ";" && depth === 0) { parts.push(cur); cur = ""; } else cur += c;
  }
  parts.push(cur);
  const body = parts.slice(0, -1).map((s) => s + ";").join("") + " return (" + parts[parts.length - 1] + ");";
  return eval("(()=>{" + body + "})()");
};
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 600), rnd = mul(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const program = () => {
    const k = rnd();
    if (k < 0.3) { const a = 1 + Math.floor(rnd() * 20), b = 1 + Math.floor(rnd() * 9), op = pick(["+=", "-=", "*="]); return `let x=${a};x${op}${b};x`; }
    if (k < 0.45) { const a = 1 + Math.floor(rnd() * 8); return `let x=${a};x*=x;x`; }                  // self-reference
    if (k < 0.6) { const a = 1 + Math.floor(rnd() * 10), b = 1 + Math.floor(rnd() * 6), c = 1 + Math.floor(rnd() * 6); return `let x=${a};x+=${b};x*=${c};x`; } // chained
    if (k < 0.8) { const N = 2 + Math.floor(rnd() * 6), op = pick(["+=", "*="]); const init = op === "*=" ? 1 : 0; return `let s=${init};for(let i=1;i<=${N};i+=1){s${op}i};s`; } // accumulator loop
    const w = pick(["a", "x", "hi"]), w2 = pick(["b", "y", "!"]); return `let s=${JSON.stringify(w)};s+=${JSON.stringify(w2)};s`; // string +=
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
  if (!fails.length) console.log(`PASS jsint-compound: ${checked} compound-assignment programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL jsint-compound: " + f); process.exit(1); }
