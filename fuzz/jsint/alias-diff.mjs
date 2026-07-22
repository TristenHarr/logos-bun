// fuzz/jsint/alias-diff — the E0 heap value-model lock. Objects are HANDLES into a
// native heap, so JS reference semantics hold: an alias (`let p=o`) shares one mutable
// cell, a write through the alias is seen through the original, and identity is real
// (`o===o` true, `{}!=={}` false, `typeof {}` object). Object.assign mutates and returns
// the SAME target. This is the property the old value-model string engine structurally
// could not have; it gates classes / Map-Set-by-identity / the whole spine. Diffed vs Node.
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
  const key = () => "abcde"[ri(5)];
  const program = () => {
    const k = ri(10);
    const a = key(), b = key(), va = sn(), vb = sn();
    if (k === 0) return `let o={${a}:${va}};let p=o;p.${a}=${vb};o.${a}`;               // write-through
    if (k === 1) return `let o={};let p=o;p.${a}=${vb};JSON.stringify(o)`;               // add-through-alias
    if (k === 2) return `let o={};o===o`;                                                // self-identity
    if (k === 3) return `({})===({})`;                                                   // distinct literals
    if (k === 4) return `let x={};let y={};x===y`;                                       // distinct vars
    if (k === 5) return `let o={};let p=o;o===p`;                                        // alias-identity
    if (k === 6) return `typeof {${a}:${va}}`;                                           // typeof object
    if (k === 7) return `let o={${a}:{${b}:${va}}};let p=o.${a};p.${b}=${vb};o.${a}.${b}`; // nested alias
    if (k === 8) return `let a={${a}:1};let b=a;let c=b;c.${a}=${vb};a.${a}`;            // 3-way chain
    return `let o={${a}:${va}};Object.assign(o,{${b}:${vb}})===o`;                        // assign returns target
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
  if (!fails.length) console.log(`PASS jsint-alias: ${checked} alias/identity programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-alias: " + f); process.exit(1); }
