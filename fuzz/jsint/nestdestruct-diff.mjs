// fuzz/jsint/nestdestruct — nested array destructuring: [a,[b,c]], [[a,b],c], [[[x]]]. destructArrLoop
// bound a nested pattern field as a plain variable name, and destructureArr truncated a nested-FIRST
// pattern at the first `]`. Flat destructuring is the regression guard. Exercised inside a function so
// the bindings are observable.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  // build matching (pattern, value) with random nesting; names a,b,c,d,e used once each
  let nm;
  const build = (d) => {
    if (d <= 0 || ri(2)) { const v = ri(20); return { pat: "abcde"[nm++], val: String(v), sum: v }; }
    const parts = Array.from({ length: 1 + ri(2) }, () => build(d - 1));
    return { pat: "[" + parts.map(p => p.pat).join(",") + "]", val: "[" + parts.map(p => p.val).join(",") + "]", sum: parts.reduce((a, p) => a + p.sum, 0) };
  };
  const program = () => {
    nm = 0;
    const b = build(3);
    if (nm === 0) return `(function(){let ${b.pat}=${b.val}; return ${b.pat}})()`; // degenerate single
    const names = "abcde".slice(0, nm).split("");
    return `(function(){let ${b.pat}=${b.val}; return ${names.join("+")}})()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-nestdestruct: ${checked} nested-destructuring programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-nestdestruct: " + f); process.exit(1); }
