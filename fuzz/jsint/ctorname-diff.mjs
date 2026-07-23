// fuzz/jsint/ctorname — `value.constructor.name`, the common runtime type-probe. `.constructor` wasn't
// resolved at all (→ NaN). Now resolveCtor rewrites `<value> . constructor` to a synthetic `{ name: <type> }`
// so a following `.name` resolves normally: Array/Object/String/Number/Boolean/Function, an Error reports
// its own `name` (TypeError/RangeError/…), and an object with its OWN `constructor` property is left alone.
// Constructor IDENTITY (`x.constructor === Array`) and a class instance's real class name are deferred.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 400), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const recvs = [
    () => `[${ri(9)},${ri(9)}]`,
    () => `({a:${ri(9)}})`,
    () => JSON.stringify("s" + ri(9)),
    () => String(ri(999)),
    () => `${ri(2) ? "true" : "false"}`,
    () => ri(2) ? `(function(){return ${ri(9)}})` : `(x=>x+${ri(9)})`,  // a Function
    () => `new Error(${JSON.stringify("e" + ri(9))})`,
    () => `new TypeError("t")`,
    () => `new RangeError("r")`,
  ];
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const r = recvs[ri(recvs.length)]();
    const prog = `(function(){ return (${r}).constructor.name })()`;
    let ref; try { ref = String(eval(prog)); } catch { continue; }
    const got = run(prog);
    if (got !== ref) fails.push(`${prog}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-ctorname: ${checked} constructor.name programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-ctorname: " + f); process.exit(1); }
