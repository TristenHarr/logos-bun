// fuzz/jsint/elseif-diff — the P7 JS engine's `else if` CHAINS, differential-fuzzed
// vs Node eval. execIf previously ran an `else if` block unconditionally (treated
// it as a plain `else`); now, when the text after `else` starts with `if `, execIf
// recurses on that nested if — so a multi-arm `if / else if / … / else` selects the
// first matching arm exactly like JS. Covers 2-, 3-, and 4-arm chains with numeric
// range guards.
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
  const program = () => {
    const x = Math.floor(rnd() * 14);                 // 0..13
    const arms = 2 + Math.floor(rnd() * 3);           // 2..4 arms (incl. the final else)
    // Descending thresholds so each arm is reachable.
    const ths = [];
    let t = 10 + Math.floor(rnd() * 3);
    for (let i = 0; i < arms - 1; i++) { ths.push(t); t -= 2 + Math.floor(rnd() * 3); }
    let code = `let x=${x};let r=0;if(x>${ths[0]}){r=1}`;
    for (let i = 1; i < arms - 1; i++) code += `else if(x>${ths[i]}){r=${i + 1}}`;
    code += `else{r=${arms}};r`;
    return code;
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
  if (!fails.length) console.log(`PASS jsint-elseif: ${checked} else-if-chain programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL jsint-elseif: " + f); process.exit(1); }
