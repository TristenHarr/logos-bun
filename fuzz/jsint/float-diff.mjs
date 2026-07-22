// fuzz/jsint/float-diff — IEEE-754 floating point. Any expression involving division or a decimal
// literal routes to a native f64 evaluator (the same doubles JS uses) and is formatted JS-style
// (whole values drop the .0; Infinity/-Infinity/NaN spelled the JS way; shortest round-trip otherwise
// -- matching V8's 0.1+0.2 == 0.30000000000000004). Pure integer + - * stays on the exact i64 path.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ours = (e) => { const r = spawnSync(OURS, ["__js", e], { encoding: "utf8" }); return r.status !== 0 ? `ERR:${r.status}` : (r.stdout || "").replace(/\n$/, ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 2000), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const fv = () => { const whole = ri(50); const frac = ri(100); return ri(4) === 0 ? String(whole) : `${whole}.${frac}`; };
  const iv = () => String(1 + ri(40));
  const op = () => ["+", "-", "*", "/"][ri(4)];
  const expr = () => {
    const t = ri(6);
    if (t === 0) return `${fv()} ${op()} ${fv()}`;
    if (t === 1) return `${iv()} / ${iv()}`;
    if (t === 2) return `( ${fv()} + ${fv()} ) / ${iv()}`;
    if (t === 3) return `${fv()} * ${iv()} - ${fv()}`;
    if (t === 4) return `${iv()} + ${iv()} * ${iv()}`;   // pure integer, exact path
    return `${fv()} / ${fv()} + ${iv()}`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const e = expr().replace(/ /g, "");
    let ref; try { ref = String(eval(e)); } catch { continue; }
    const got = ours(e);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(e)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-float: ${checked} float expressions agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-float: " + f); process.exit(1); }
