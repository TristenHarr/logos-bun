// fuzz/jsint/replstmt — a program whose LAST statement is a STATEMENT-FORM (console.log, a control-
// flow block that logs, a hoisted-call program). runProgram used to evaluate the trailing statement
// as an EXPRESSION (jsEvalIn), so `console.log(…)` last stack-overflowed and let/if/for/function
// returned NaN. Fixed: a trailing statement-form runs via execStmt (side effect, value undefined).
// The oracle is Node's stdout (what console.log printed), compared against OUR stdout with the
// trailing REPL value line (`undefined`) stripped — we only assert the SIDE EFFECT matches and there
// is no crash.
import { spawnSync, execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// our stdout, with a trailing bare `undefined` REPL-value line removed
const run = (p) => {
  const r = spawnSync(OURS, ["__js", p], { encoding: "utf8" });
  if (r.status !== 0) return `ERR:${r.status}`;
  const lines = (r.stdout || "").replace(/\n$/, "").split("\n");
  if (lines.length && lines[lines.length - 1] === "undefined") lines.pop();
  return lines.join("\n");
};
// node's console.log output (the side effect only)
const nodeOut = (p) => {
  try { return execFileSync(process.execPath, ["-e", p], { encoding: "utf8" }).replace(/\n$/, ""); }
  catch { return null; }
};
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 300), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const k = ri(5);
    if (k === 0) return `console.log(${1 + ri(999)})`;                                   // number
    if (k === 1) return `console.log(${JSON.stringify("s" + ri(9999))})`;                  // string
    if (k === 2) return `let a=${ri(50)},b=${ri(50)}; console.log(a+b)`;                    // computed
    if (k === 3) return `if(${ri(2)}){ console.log("yes") } else { console.log("no") }`;    // control-flow last
    return `console.log(g(${ri(20)})); function g(n){return n*${1 + ri(9)}}`;               // hoisted call
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    const ref = nodeOut(p); if (ref === null) continue;
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-replstmt: ${checked} trailing-statement programs agree with Node stdout (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-replstmt: " + f); process.exit(1); }
