// fuzz/jsint/templatemethod — a method/property access on a template literal WITH interpolation
// (`${x}`.repeat(3), `x${2}y`.slice(1), `${a}${b}`.length). Interpolation desugars to "" + (x) + "",
// which is unparenthesized, so a trailing .method() bound to the last operand instead of the whole
// template. desugarTemplatesN now wraps each template in parentheses. Bare templates, templates as
// object values / array elements / call args, and plain interpolation are regressions. Diffed vs Node.
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
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 300), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = ri(9), b = ri(9), k = ri(9);
    if (k === 0) return "`${" + a + "}`.repeat(" + (1 + ri(3)) + ")";
    if (k === 1) return "`x${" + a + "}y`.length";
    if (k === 2) return "`${" + a + "}${" + b + "}`.split(\"\").length";
    if (k === 3) return "`v${" + a + "}`.toUpperCase()";
    if (k === 4) return "`${" + a + "+" + b + "}`.charAt(0)";
    if (k === 5) return "`abc" + a + "`.slice(1)";                     // regression: bare template + method
    if (k === 6) return "`a${" + a + "}b`";                           // regression: plain interpolation
    if (k === 7) return "JSON.stringify({v:`n${" + a + "}`})";        // regression: template as obj value
    return "[`${" + a + "}`,`${" + b + "}`].join(\"-\")";             // regression: templates in array
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-templatemethod: ${checked} template-method programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-templatemethod: " + f); process.exit(1); }
