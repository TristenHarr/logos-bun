// fuzz/jsint/object-diff — the P7 JS engine's OBJECT value model (literals +
// dot access + bracket access + nested objects + objects-in-arrays), differential
// -fuzzed vs Node eval. Objects are a tagged value (chr(7); entries chr(6)-joined,
// key/value split by chr(8)); {k:v,...} literals build in a pass parallel to the
// array/call passes, o.k dot access + o["k"] bracket access resolve against it.
// Missing key → "undefined" (String(undefined)). Bare object → "[object Object]".
// Keys are drawn from a pool disjoint from variable names (this string-surgery
// engine can't tell a key position from a variable reference — a real limitation,
// scoped around here, not papered over).
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 700), rnd = mul(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const KEYS = ["k0", "k1", "k2", "k3", "k4"];       // disjoint from var names (o,a,i,s,v)
  const num = () => Math.floor(rnd() * 40);
  const words = ["hi", "yo", "bun", "logos", "zed"];
  // Build an object literal with `cnt` scalar/string entries over distinct keys.
  const objLit = (cnt, strVals) => {
    const ks = KEYS.slice(0, cnt);
    return "{" + ks.map((k) => `${k}:${strVals ? JSON.stringify(pick(words)) : num()}`).join(",") + "}";
  };
  const program = () => {
    const k = rnd();
    if (k < 0.12) return objLit(1 + Math.floor(rnd() * 3), rnd() < 0.5);        // bare literal → [object Object]
    if (k < 0.30) { const c = 2 + Math.floor(rnd() * 3), key = pick(KEYS.slice(0, c)); return `let o=${objLit(c, false)};o.${key}`; }         // dot
    if (k < 0.45) { const c = 2 + Math.floor(rnd() * 3), key = pick(KEYS.slice(0, c)); return `let o=${objLit(c, false)};o[${JSON.stringify(key)}]`; } // bracket
    if (k < 0.58) { const c = 1 + Math.floor(rnd() * 2); return `let o=${objLit(c, true)};o.${pick(KEYS.slice(0, c))}`; }                    // string value
    if (k < 0.68) { const c = 1 + Math.floor(rnd() * 2); return `let o=${objLit(c, false)};o.k9`; }                                          // missing key → undefined
    if (k < 0.80) { const c = 2 + Math.floor(rnd() * 2); const o = objLit(c, false); return `let o=${o};o.k0+o.k1`; }                        // arithmetic on fields
    if (k < 0.88) { const v = num(); return `let v=${v};let o={k0:v,k1:${num()}};o.k0`; }                                                     // value from variable
    if (k < 0.86) { const a = num(), b = num(); return `let o={k0:${a},k1:{k2:${b}}};o.k1.k2`; }                                              // nested object (single-entry inner)
    if (k < 0.9) { const a = num(), b = num(), c = num(); const key = pick(["x", "y"]); return `let o={p:{x:${a},y:${b}},q:${c}};o.p.${key}+o.q`; } // MULTI-ENTRY nested object + sibling
    if (k < 0.93) { const a = num(), b = num(); return `let o={k0:${a}};let o2={k0:o.k0+${b}};o2.k0`; }                                       // COMPUTED value (member access + arith)
    if (k < 0.94) { const a = num(), b = num(), c = num(); return `let o={k0:[${a},${b},${c}],k1:${num()}};o.k0`; }                            // ARRAY-valued field (read whole array)
    if (k < 0.97) { const a = num(), b = num(), c = num(), i = Math.floor(rnd() * 3); return `let o={k0:[${a},${b},${c}]};o.k0[${i}]`; }        // MEMBER-then-INDEX (o.k[i])
    const a = num(), b = num(), i = rnd() < 0.5 ? 0 : 1; return `let a=[{k0:${a}},{k0:${b}}];a[${i}].k0`;                                     // object in array
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = nodeRun(p); } catch { continue; }
    if (typeof ref === "number" && (!Number.isInteger(ref) || Math.abs(ref) > 1e15)) continue;
    ref = String(ref);
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-object: ${checked} object programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL jsint-object: " + f); process.exit(1); }
