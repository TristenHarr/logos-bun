// fuzz/jsint/nestedmember-diff — nested member targets o.a.b = v, o.a.b.c = v,
// o.a.b.push(x), o.p.q += n. assignTarget (the shared write path for = / compound /
// push) now descends the whole ' . ' path via objSetPath: read each intermediate
// object, set the deepest key, rebuild outward. Closes the single-level limitation
// across every member mutation at once. Diffed vs Node (byte-exact via JSON.stringify).
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
  const program = () => {
    const k = ri(7);
    if (k === 0) return `let o={a:{b:${sn()}}};o.a.b=${sn()};JSON.stringify(o)`;                       // 2-level set
    if (k === 1) return `let o={a:{b:{c:${sn()}}}};o.a.b.c=${sn()};o.a.b.c`;                            // 3-level set
    if (k === 2) return `let o={a:{b:[${sn()}]}};o.a.b.push(${sn()});JSON.stringify(o)`;                // nested push
    if (k === 3) return `let o={p:{q:${sn()}}};o.p.q+=${sn()};o.p.q`;                                   // nested compound
    if (k === 4) return `let o={a:{x:${sn()},y:${sn()}}};o.a.x=${sn()};JSON.stringify(o)`;              // set one of two
    if (k === 5) return `let o={a:{b:${sn()}}};o.a.c=${sn()};JSON.stringify(o)`;                        // add key at depth
    return `let o={s:{n:0}};for(let i=1;i<=${2 + ri(4)};i++){o.s.n+=i};o.s.n`;                          // nested accumulate in loop
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
  if (!fails.length) console.log(`PASS jsint-nestedmember: ${checked} nested-member programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-nestedmember: " + f); process.exit(1); }
