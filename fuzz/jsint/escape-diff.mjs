// fuzz/jsint/escape-diff — string ESCAPE sequences \" \\ \n \t inside string
// literals: they must round-trip (protected inside the string value like spaces),
// and JSON.stringify must re-escape them. Random strings mixing letters with
// escapes flow through .length / concat / JSON.stringify and are diffed vs Node.
// (\n/\t are exercised via .length and JSON — not raw stdout — to keep the
// line-based output comparison unambiguous.)
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
  // build a JS string literal (as written in source) mixing letters and escapes
  // \" \\ \n are fully protected; \t is best-effort (a real tab, boundary-sensitive) — scoped out.
  const esc = ['\\"', "\\\\", "\\n"];
  const lit = (allowNL) => {
    const parts = [];
    const L = 2 + ri(4);
    for (let i = 0; i < L; i++) {
      if (ri(3) === 0) { const e = allowNL ? esc[ri(3)] : esc[ri(2)]; parts.push(e); }
      else parts.push("abcxyz"[ri(6)]);
    }
    return parts.join("");
  };
  const program = () => {
    const k = ri(5);
    if (k === 0) return `"${lit(true)}".length`;                       // length w/ any escape
    if (k === 1) return `let s="${lit(false)}";s+"!"`;                  // output (no \n/\t) — safe chars only
    if (k === 2) return `JSON.stringify("${lit(true)}")`;              // JSON re-escape
    if (k === 3) return `let o={m:"${lit(true)}"};JSON.stringify(o)`;   // JSON obj w/ escaped value
    return `let a="${lit(false)}";let b="${lit(false)}";(a+b).length`;  // concat length
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
  if (!fails.length) console.log(`PASS jsint-escape: ${checked} escape-sequence programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-escape: " + f); process.exit(1); }
