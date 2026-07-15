// fuzz/jsint/typeof-diff — the P7 JS engine's `typeof` operator, differential-
// fuzzed vs Node eval. typeof is a direct inspection of the value-model tag:
// number (plain) / string (chr3) / boolean (true|false) / object (chr5 array or
// chr7 object — JS reports both as "object"). Covers bare typeof, typeof in an
// equality test (the common `typeof x === "number"` guard), and typeof of a
// member (o.k / a[i]). Not fuzzed: typeof of a function value (stored by name,
// not inlinable yet) or typeof undefined.
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
const nodeRun = (p) => { const parts = p.split(";"); const body = parts.slice(0, -1).map((s) => s + ";").join("") + " return (" + parts[parts.length - 1] + ");"; return eval("(()=>{" + body + "})()"); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 600), rnd = mul(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  // A value literal + its exact JS typeof, so we can also fuzz the === guard.
  const vals = [
    () => [String(Math.floor(rnd() * 100)), "number"],
    () => [JSON.stringify(pick(["hi", "a b", "logos"])), "string"],
    () => [pick(["true", "false"]), "boolean"],
    () => [`[${Math.floor(rnd() * 9)},${Math.floor(rnd() * 9)}]`, "object"],
  ];
  // Scalar-only values (no array) for the member/element cases — an array-valued
  // object field / nested array is a separate deferred limitation (resolveObjects
  // runs before resolveArrays), unrelated to typeof (arrays are covered by the
  // bare/variable cases below).
  const scalarVals = vals.slice(0, 3);
  const program = () => {
    const [lit, ty] = pick(vals)();
    const k = rnd();
    if (k < 0.3) return `typeof ${lit}`;                                            // bare typeof of a literal (incl. arrays)
    if (k < 0.55) return `let x=${lit};typeof x`;                                    // typeof of a variable (incl. arrays)
    if (k < 0.78) { const probe = pick(["number", "string", "boolean", "object"]); return `let x=${lit};typeof x=="${probe}"`; } // the guard (may be true or false)
    if (k < 0.9) { const [s] = pick(scalarVals)(); return `let o={k0:${s}};typeof o.k0`; }  // typeof of a member (scalar value)
    const [s] = pick(scalarVals)(); return `let a=[${s}];typeof a[0]`;              // typeof of an element (scalar value)
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = nodeRun(p); } catch { continue; }
    ref = String(ref);
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-typeof: ${checked} typeof programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL jsint-typeof: " + f); process.exit(1); }
