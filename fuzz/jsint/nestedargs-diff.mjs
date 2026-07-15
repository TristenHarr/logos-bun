// fuzz/jsint/nestedargs-diff — NESTED-CALL ARGUMENTS (gap#3, arg-side of the
// balanced extractor): a call whose argument is itself a call —
// Math.max(Math.abs(x),y), String.fromCharCode(s.charCodeAt(i)), abs(min(a,b)),
// a global of a JSON.parse, etc. — now extract the arg with balancedArg instead
// of the naive first-')'. Random such programs run through logos-bun __js AND
// Node eval and required to agree.
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
  const nn = () => 1 + ri(19) - 10;  // -9..9
  const program = () => {
    const k = ri(7);
    if (k === 0) return `Math.max(Math.abs(${nn()}),${sn()})`;
    if (k === 1) return `Math.min(Math.abs(${nn()}),Math.abs(${nn()}))`;
    if (k === 2) return `Math.abs(Math.min(${nn()},${nn()}))`;
    if (k === 3) return `Math.max(Math.min(${sn()},${sn()}),Math.abs(${nn()}))`;
    if (k === 4) return `String.fromCharCode(65+Math.abs(${nn() % 5}))`;
    if (k === 5) { const w = ["cat", "dog", "fox"][ri(3)]; return `String.fromCharCode("${w}".charCodeAt(${ri(3)}))`; }
    return `Math.abs(Math.max(Math.min(${nn()},${nn()}),${nn()}))`;
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
  if (!fails.length) console.log(`PASS jsint-nestedargs: ${checked} nested-call-argument programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-nestedargs: " + f); process.exit(1); }
