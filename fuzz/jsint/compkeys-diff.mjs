// fuzz/jsint/compkeys-diff — computed property keys {[k]: v} + multi-declaration
// let a=1, b=2. objKeyOf evaluates a [expr] key (already substituted by the time
// buildObj runs) to its string value. bindAssign splits a declaration on top-level
// commas (patFields — bracket-aware, so an object/array literal RHS isn't split) and
// binds each — a real gap the NaN model surfaced (let a=1,b=2 used to leave b unbound).
// Diffed vs Node (byte-exact via JSON.stringify).
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
  const name = () => "abcde"[ri(5)];
  const commaStr = () => ["a,b", "1,2,3", "x, y", "10,20,30"][ri(4)];
  const program = () => {
    const k = ri(10);
    if (k === 0) { const kk = name(); return `let key="${kk}";let o={[key]:${sn()}};JSON.stringify(o)`; }        // string var key
    if (k === 1) return `let a=${sn()},b=${sn()};let o={[a+b]:${sn()}};JSON.stringify(o)`;                         // arithmetic computed key
    if (k === 2) return `let a=${sn()},b=${sn()};a+b`;                                                              // multi-decl arith
    if (k === 3) return `let a=${sn()},b=${sn()},c=${sn()};a*b-c`;                                                  // 3 decls
    if (k === 4) { const kk = name(); return `let i=${ri(5)};let o={["${kk}"+i]:${sn()}};JSON.stringify(o)`; }     // concat key
    if (k === 5) return `let a=[${sn()},${sn()}],b=[${sn()}];a.length+b.length`;                                    // multi-decl arrays (not split)
    if (k === 6) return `let o={a:${sn()},b:${sn()}};JSON.stringify(o)`;                                            // object literal (comma not a decl sep)
    if (k === 7) return `let s=${JSON.stringify(commaStr())},n=${sn()};s.split(",").length+n`;                      // multi-decl w/ comma-in-string
    if (k === 8) return `let o={a:${JSON.stringify(commaStr())},b:${sn()}};JSON.stringify(o)`;                      // object literal, comma-in-string value
    return `let x=${sn()},y=${sn()};let o={[x]:1,[y]:2};Object.keys(o).length`;                                     // two computed keys
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
  if (!fails.length) console.log(`PASS jsint-compkeys: ${checked} computed-key/multi-decl programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-compkeys: " + f); process.exit(1); }
