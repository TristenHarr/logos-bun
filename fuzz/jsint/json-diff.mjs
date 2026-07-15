// fuzz/jsint/json-diff — JSON.stringify over random JSON-serializable values
// (numbers, strings, booleans, arrays, and objects with insertion-ordered keys,
// including nesting), each run through logos-bun __js AND Node eval and required
// to agree BYTE-FOR-BYTE (key order, quoting, separators all matter).
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const sn = () => 1 + ri(99);
  const keys = "abcdef";
  const words = ["cat", "dog", "fox", "owl"];
  const numArr = () => "[" + Array.from({ length: 2 + ri(3) }, () => sn()).join(",") + "]";
  const strArr = () => "[" + Array.from({ length: 2 + ri(2) }, () => `"${words[ri(4)]}"`).join(",") + "]";
  const flatObj = () => { const nk = 2 + ri(3); const used = new Set(); const parts = []; while (parts.length < nk) { const k = keys[ri(6)]; if (used.has(k)) continue; used.add(k); const v = ri(3) === 0 ? `"${words[ri(4)]}"` : `${sn()}`; parts.push(`${k}:${v}`); } return "{" + parts.join(",") + "}"; };
  const nestObj = () => `{a:${sn()},b:${flatObj()},c:${numArr()}}`;
  const program = () => {
    const k = ri(7);
    if (k === 0) return `JSON.stringify(${sn()})`;
    if (k === 1) return `JSON.stringify(${numArr()})`;
    if (k === 2) return `JSON.stringify(${strArr()})`;
    if (k === 3) return `let o=${flatObj()};JSON.stringify(o)`;
    if (k === 4) return `let o=${nestObj()};JSON.stringify(o)`;
    if (k === 5) return `JSON.stringify([${flatObj()},${flatObj()}])`;
    return `JSON.stringify([true,false,null,${sn()}])`;
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
  if (!fails.length) console.log(`PASS jsint-json: ${checked} JSON.stringify programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-json: " + f); process.exit(1); }
