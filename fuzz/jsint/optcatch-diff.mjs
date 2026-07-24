// fuzz/jsint/optcatch — the optional catch binding `catch { … }` (no `(e)`). execTry extracted the binding
// via substringAfter(rest1, "(")/")"), which for a binding-less `catch {` grabbed garbage, so the catch
// block didn't run (→ NaN). Added a branch: when `catch` is followed directly by `{`, run the block with an
// empty binding. This fuzzer builds try/catch programs mixing the binding-less and `(e)` forms, with and
// without finally, and compares the observable result vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 300), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const doThrow = ri(2) === 0;
    const body = doThrow ? `throw ${ri(3) === 0 ? `new Error("e${ri(9)}")` : ri(99)}` : `let ok=${ri(99)}`;
    const bindless = ri(2) === 0;
    const catchRet = bindless ? `return "C${ri(9)}"` : `return "C:"+(e&&e.message?e.message:e)`;
    const cat = bindless ? `catch { ${catchRet} }` : `catch(e) { ${catchRet} }`;
    const fin = ri(3) === 0 ? ` finally { }` : "";
    return `(function(){ try { ${body}; return "T${ri(9)}" } ${cat}${fin} })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-optcatch: ${checked} try/catch programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-optcatch: " + f); process.exit(1); }
