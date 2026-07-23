// fuzz/jsint/defaultparam — default parameter values (`(a=1,b=2)=>a+b`, `function f(a=5){}`) when a
// call omits the trailing (or all) arguments. Partial omission already worked; the ALL-args-missing
// case (`()`) returned NaN because the empty arg slot read as "" instead of undefined, so the default
// never fired. Fixed in argAt: an empty positional slot is `undefined` (→ default fires). Guard:
// a real empty-string literal `""` is a non-empty token and must still bind (NOT trigger the default).
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
  const program = () => {
    const k = ri(6);
    if (k === 0) { // two defaults, 0..2 args supplied
      const d1 = ri(9), d2 = ri(9), na = ri(3), args = Array.from({ length: na }, () => ri(20));
      const kind = ri(2) ? `(a=${d1},b=${d2})=>a+b` : `function(a=${d1},b=${d2}){return a+b}`;
      return `(${kind})(${args.join(",")})`;
    }
    if (k === 1) { // single default param
      const d = ri(50), supply = ri(2), v = ri(50);
      return `((a=${d})=>a*2)(${supply ? v : ""})`;
    }
    if (k === 2) { // trailing default only (first required)
      const d = ri(9), a = ri(20), giveB = ri(2), b = ri(20);
      return `((a,b=${d})=>a+b)(${a}${giveB ? "," + b : ""})`;
    }
    if (k === 3) { // default referencing an earlier parameter
      const x = ri(20);
      return `((x, y=x*2)=>x+y)(${x})`;
    }
    if (k === 4) { // string default vs explicit empty-string literal (the guard)
      const useEmpty = ri(2);
      return `((a="def")=>a)(${useEmpty ? '""' : ""})`;
    }
    // k === 5: three params, middle/last defaulted, partial supply
    const d2 = ri(9), d3 = ri(9), na = ri(4), args = Array.from({ length: na }, () => ri(9));
    return `((a,b=${d2},c=${d3})=>String(a)+"/"+b+"/"+c)(${args.join(",")})`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-defaultparam: ${checked} default-param programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-defaultparam: " + f); process.exit(1); }
