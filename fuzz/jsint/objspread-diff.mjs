// fuzz/jsint/objspread-diff — object SPREAD {...o, k: v} and merge {...a, ...b}.
// A `...expr` entry splices the object's own entries; a later key OVERRIDES an
// earlier one keeping its FIRST position but LAST value (JS dedupe semantics).
// Validated byte-exact via JSON.stringify (which exercises key order AND dedup).
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
  const sn = () => 1 + ri(9);
  const keys = "abcde";
  const obj = () => { const nk = 1 + ri(3); const used = new Set(); const parts = []; while (parts.length < nk) { const k = keys[ri(5)]; if (used.has(k)) continue; used.add(k); parts.push(`${k}:${sn()}`); } return "{" + parts.join(",") + "}"; };
  // Variables are multi-char (src/dst/mid) so their names never collide with the
  // single-letter object keys a..e — that collision is a separate pre-existing
  // substitute bug (BUG-40), unrelated to spread.
  const program = () => {
    const k = ri(6);
    if (k === 0) return `let src=${obj()};let dst=${obj()};JSON.stringify({...src,...dst})`; // merge (may collide keys)
    if (k === 1) return `let src=${obj()};JSON.stringify({...src,${keys[ri(5)]}:${sn()}})`;   // spread + field (may override)
    if (k === 2) return `let src=${obj()};JSON.stringify({${keys[ri(5)]}:${sn()},...src})`;   // field then spread
    if (k === 3) return `let src=${obj()};JSON.stringify({...src})`;                          // clone
    if (k === 4) return `let src=${obj()};let mid={...src,${keys[ri(5)]}:99};Object.keys(mid).length`;
    return `let src=${obj()};let dst=${obj()};let mid={...src,...dst};Object.values(mid).length`;
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
  if (!fails.length) console.log(`PASS jsint-objspread: ${checked} object-spread programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-objspread: " + f); process.exit(1); }
