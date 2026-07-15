// fuzz/jsint/strbracket-diff — string VALUES containing structural characters
// ( [ ] { } ( ) ) must round-trip: they are protected inside string values
// (encoded like chr(4) spaces) so the substitution / array / object passes don't
// mis-read them as syntax, then decoded at output. Random strings mixing letters
// and brackets/braces/parens flow through length/charAt/concat/methods/templates
// and are diffed vs Node.
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
  const pieces = ["a", "b", "x", "[", "]", "{", "}", "(", ")", "1", "z"];  // no space/comma/quote/backslash
  const str = () => { let s = ""; const L = 2 + ri(6); for (let i = 0; i < L; i++) s += pieces[ri(pieces.length)]; return s; };
  const program = () => {
    const k = ri(6), s = str();
    if (k === 0) return `"${s}".length`;
    if (k === 1) return `let s="${s}";s+"!"`;
    if (k === 2) { const i = ri(s.length); return `"${s}".charAt(${i})`; }
    if (k === 3) return `let s="${s}";s.toUpperCase()`;
    if (k === 4) return `let a="${str()}";let b="${str()}";a+b`;
    return "`x=${\"" + s + "\"}`";
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
  if (!fails.length) console.log(`PASS jsint-strbracket: ${checked} structural-char string programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-strbracket: " + f); process.exit(1); }
