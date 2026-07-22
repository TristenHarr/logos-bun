// fuzz/jsint/arralias-diff — the E0 heap value-model lock for ARRAYS. Arrays are HANDLES
// into the same native heap as objects, so JS reference semantics hold: an alias shares one
// mutable cell, an in-place mutation (push/pop/[i]=/reverse/fill/sort) through any alias is
// seen through the original, and identity is real (`a===a` true, `[1]!==[1]` false,
// `Array.isArray` true, `typeof [] ` object). This is the property the old value-model string
// engine structurally could not have. Diffed vs Node.
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
const nodeRun = (p) => {
  let depth = 0, parts = [], cur = "";
  for (const c of p) { if (c === "{" || c === "(" || c === "[") depth++; else if (c === "}" || c === ")" || c === "]") depth--; if (c === ";" && depth === 0) { parts.push(cur); cur = ""; } else cur += c; }
  parts.push(cur);
  const body = parts.slice(0, -1).map((s) => s + ";").join("") + " return (" + parts[parts.length - 1] + ");";
  return eval("(()=>{" + body + "})()");
};
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const sn = () => 1 + ri(9);
  const lit = () => { const k = 1 + ri(4); const xs = []; for (let i = 0; i < k; i++) xs.push(sn()); return "[" + xs.join(",") + "]"; };
  const program = () => {
    const k = ri(12);
    const A = lit(), v = sn(), i = ri(3);
    if (k === 0) return `let a=${A};let b=a;b.push(${v});a.join(",")`;                 // push-through
    if (k === 1) return `let a=${A};let b=a;b.push(${v});a.length`;                    // length-through
    if (k === 2) return `let a=${A};let b=a;b[0]=${v};a[0]`;                            // index-write-through
    if (k === 3) return `let a=${A};let b=a;b.pop();a.length`;                          // pop-through
    if (k === 4) return `let a=${A};let b=a;b.reverse();a.join(",")`;                   // reverse-through
    if (k === 5) return `let a=${A};let b=a;b.fill(${v});a.join(",")`;                  // fill-through
    if (k === 6) return `let a=${A};let b=a;b.sort();a.join(",")`;                      // sort-through (lexicographic)
    if (k === 7) return `let a=${A};let b=a;a===b`;                                     // alias identity
    if (k === 8) return `${A}===${A}`;                                                  // distinct literals
    if (k === 9) return `let o={xs:${A}};let r=o.xs;r.push(${v});o.xs.length`;          // member-array alias
    if (k === 10) return `Array.isArray(${A})`;                                         // isArray
    return `typeof ${A}`;                                                               // typeof array
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
  if (!fails.length) console.log(`PASS jsint-arralias: ${checked} array alias/identity programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-arralias: " + f); process.exit(1); }
