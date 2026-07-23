// fuzz/jsint/nullaccess — reading a property off null/undefined must throw a TypeError, not return NaN.
// `resolveObjDot`/`resolveArrays` returned the expression unchanged when the receiver wasn't an object,
// so `null.x` / `undefined[0]` silently became NaN. Now a nullish receiver raises a TypeError through the
// thread-local throw channel (throwSet + newError), and the return handler defers to a pending throw
// instead of returning — so `return null.x`, `let z = null.x`, and a chained `o.a.b` (where `a` is null)
// all throw and are catchable. This fuzzer checks a spread of nullish accesses (throwing) and normal
// accesses (not throwing) against Node's throw/no-throw + value. Arg-position (`f(null.x)`) is a known
// deferred gap (the call machinery doesn't yet check the pending throw), so it is not generated here.
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
  // each returns a program whose body either throws (nullish access) or not (normal), wrapped so the
  // observable is "THROW:<name>" on throw or the string value otherwise — matching the Node oracle below.
  const cases = [
    () => `null.${["x", "foo", "bar"][ri(3)]}`,
    () => `undefined.${["a", "b"][ri(2)]}`,
    () => `null[${JSON.stringify(["x", "0", "k"][ri(3)])}]`,
    () => `undefined[${ri(3)}]`,
    () => `({a:null}).a.${["b", "c"][ri(2)]}`,
    () => `({}).missing.${["x"][0]}`,           // undefined.x → throws
    () => `({x:${ri(9)}}).x`,                    // normal → value
    () => `[${ri(9)},${ri(9)}][${ri(2)}]`,       // normal index
    () => `({k:${ri(9)}})[${JSON.stringify("k")}]`, // normal bracket
    () => `"abc".length`,                        // normal
  ];
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const expr = cases[ri(cases.length)]();
    const mode = ri(2); // return vs let-binding
    const prog = mode === 0
      ? `(function(){ try { return ${expr} } catch(e){ return "THROW:"+e.name } })()`
      : `(function(){ try { let z = ${expr}; return String(z) } catch(e){ return "THROW:"+e.name } })()`;
    let ref; try { ref = String(eval(prog)); } catch { continue; }
    const got = run(prog);
    if (got !== ref) fails.push(`${prog}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-nullaccess: ${checked} null-access programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-nullaccess: " + f); process.exit(1); }
