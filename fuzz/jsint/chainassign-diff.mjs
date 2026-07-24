// fuzz/jsint/chainassign — chained assignment `a = b = c` (and `let y = x = v`). The right-associative
// chain only set the LEFTMOST target: `a=b=7` gave a=7 but left b undefined, because the RHS `b = 7` was
// evaluated as an expression (yielding 7) without mutating b. Fixed: when the RHS of an assignment
// statement (or let-initializer) itself contains a top-level ` = `, execute that RHS as a statement first
// (setting the inner target), then assign the outer target to it — recursively, so `a=b=c=9` threads all
// the way down. Depth-aware, so comparisons (`==`/`===`) and `=` inside parens/arrows don't trip it.
// Exercises scalar chains, member/bracket chains (`o.x=o.y=v`, `arr[i]=arr[j]=v`), and let-initializer
// chains, diffed vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 200), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const v = ri(100), k = ri(7);
    if (k === 0) return `(function(){let a,b;a=b=${v};return a+"/"+b})()`;
    if (k === 1) return `(function(){let a,b,c;a=b=c=${v};return a+"/"+b+"/"+c})()`;
    if (k === 2) return `(function(){let x=${ri(50)},y=${ri(50)};x=y=${v};return x+","+y})()`;
    if (k === 3) return `(function(){const o={};o.x=o.y=${v};return o.x+"/"+o.y})()`;
    if (k === 4) return `(function(){const a=[0,0,0];const i=${ri(3)};a[i]=a[0]=${v};return a.join(",")})()`;
    if (k === 5) return `(function(){let x=1;let y=x=${v};return x+"/"+y})()`;
    // regression: simple + comparison + ternary must be unaffected
    return `(function(){let a=${v};a=a>50?a-50:a+50;let b=a==${v};return a+"/"+b})()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-chainassign: ${checked} chained-assignment programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-chainassign: " + f); process.exit(1); }
