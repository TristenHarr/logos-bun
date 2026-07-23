// fuzz/jsint/incexpr-diff — `++`/`--` in EXPRESSION position (not just a bare `x++` statement): prefix
// `++x` (yields the new value), postfix `x++` (yields the old value), inside an index `a[i++]`/`a[++i]`,
// in a call arg `push(i++)`, and in an assignment RHS `let y=++x`. These worked as statements but as
// expressions returned NaN or PANICKED (a[i++]). Resolved at the statement level: incDecEnv threads the
// env applying each increment left-to-right and incDecRewrite substitutes each one's value (prefix=new,
// postfix=old), leaving a `++`/`--`-free statement run against the already-incremented env. Member
// increments (`o.c++`, `a[i]++`, guarded by prevIsDot) stay on the memberCompoundRewrite path — checked
// as regressions. Diffed vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const NODE = process.execPath;
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dir = mkdtempSync(join(tmpdir(), "inc-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 200), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = 1 + ri(9), b = 1 + ri(9);
    const k = ri(11);
    if (k === 0) return `let x=${a};let y=++x;console.log(y+","+x);`;
    if (k === 1) return `let x=${a};let y=x++;console.log(y+","+x);`;
    if (k === 2) return `let x=${a};console.log(--x);`;
    if (k === 3) return `let x=${a};console.log(x--);`;
    if (k === 4) return `let arr=[${a},${b},${a + b}];let i=0;console.log(arr[i++]+"/"+arr[i]);`;
    if (k === 5) return `let arr=[${a},${b},${a + b}];let i=0;console.log(arr[++i]);`;
    if (k === 6) return `let i=0;let r=[];while(i<3){r.push(i++);}console.log(r.join("-"));`;
    if (k === 7) return `let o={c:${a}};o.c++;console.log(o.c);`;                 // member regression
    if (k === 8) return `function g(){let x=${a};x++;return x;}console.log(g());`; // ++ INSIDE a function body
    if (k === 9) return `function fac(n){let r=1;for(let i=2;i<=n;i++){r*=i;}return r;}console.log(fac(${1 + ri(6)}));`;
    if (k === 10) return `let f=function(){let c=${a};return ++c;};console.log(f()+","+f());`;  // ++ in fn-expr body
    return `let z=[${a},${b},${a + b}];z[0]++;console.log(z[0]+"/"+z[1]);`;       // member-index regression
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src), got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${JSON.stringify(src)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-incexpr: ${checked} increment-expr programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-incexpr: " + f); process.exit(1); }
