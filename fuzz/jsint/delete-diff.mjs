// fuzz/jsint/delete-diff — the `delete` operator + Array.join edge semantics.
// delete o.k / delete o["k"] removes an own property (order preserved); delete arr[i]
// leaves a hole that reads back undefined with length unchanged. Array.join renders
// value undefined/null AND holes as the empty string (but the STRING "undefined" is
// preserved), and defaults its separator to "," when the argument is absent or undefined.
// Reflect.set / Reflect.deleteProperty mirror the same mutations. Random programs diffed
// vs Node (byte-exact via JSON.stringify / join).
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
  const elem = () => { const t = ri(4); if (t === 0) return "undefined"; if (t === 1) return "null"; if (t === 2) return `"${"xyz"[ri(3)]}"`; return String(sn()); };
  const sep = () => { const t = ri(4); if (t === 0) return ""; if (t === 1) return "undefined"; if (t === 2) return `","`; return `"-"`; };
  const program = () => {
    const k = ri(7);
    if (k === 0) return `let o={a:${sn()},b:${sn()},c:${sn()}};delete o.${key()};JSON.stringify(o)`;
    if (k === 1) return `let o={a:${sn()},b:${sn()}};delete o["${key()}"];Object.keys(o).join(",")`;
    if (k === 2) return `let a=[${sn()},${sn()},${sn()},${sn()}];delete a[${ri(4)}];a.join(",")`;
    if (k === 3) return `[${elem()},${elem()},${elem()}].join(${sep()})`;
    if (k === 4) return `let o={a:${sn()},b:${sn()}};Reflect.deleteProperty(o,"${key()}");JSON.stringify(o)`;
    if (k === 5) return `let o={a:${sn()}};Reflect.set(o,"${key()}",${sn()});JSON.stringify(o)`;
    return `let a=[${sn()},${sn()},${sn()}];delete a[${ri(3)}];a[${ri(3)}]===undefined?"u":a.join("")`;
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
  if (!fails.length) console.log(`PASS jsint-delete: ${checked} delete/join programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-delete: " + f); process.exit(1); }
