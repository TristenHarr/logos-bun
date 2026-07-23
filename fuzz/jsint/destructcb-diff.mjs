// fuzz/jsint/destructcb — a destructuring parameter ([a,b] / {x,y}) in a map/filter/find callback.
// callFnIdx bound the whole pattern as one variable name (NaN); it now delegates to the same
// destructuring used by named functions. Plain-param callbacks are the regression guard. (Nested
// patterns like [a,[b,c]] are a separate pre-existing limitation and are not exercised.)
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
  const pairs = () => "[" + Array.from({ length: 1 + ri(3) }, () => `[${ri(9)},${ri(9)}]`).join(",") + "]";
  const objs = () => "[" + Array.from({ length: 1 + ri(3) }, () => `{a:${ri(9)},b:${ri(9)}}`).join(",") + "]";
  const program = () => {
    const k = ri(7);
    if (k === 0) return `${pairs()}.map(([a,b])=>a+b).join(",")`;
    if (k === 1) return `${pairs()}.filter(([a,b])=>a<b).length`;
    if (k === 2) return `${objs()}.map(({a,b})=>a*b).join(",")`;
    if (k === 3) return `${objs()}.map(({a})=>a).join(",")`;
    if (k === 4) return `${pairs()}.reduce((s,[a,b])=>s+a+b,0)`;       // reduce + array destructure (callFn2)
    if (k === 5) return `${objs()}.reduce((s,{a})=>s+a,0)`;           // reduce + object destructure
    return `${pairs()}.map(x=>x[0]+x[1]).join(",")`;                  // plain-param regression guard
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-destructcb: ${checked} destructuring-callback programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-destructcb: " + f); process.exit(1); }
