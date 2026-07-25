// fuzz/jsint/templatequote — a template literal containing a double quote (`{"a":1}`, `he said "hi"`)
// was mangled to NaN: the desugar rewrites the backtick to a double quote but left inner quotes
// unescaped, so `{"a":1}` became "{"a":1}" and broke the string. desugarTemplatesN now escapes a raw
// " inside template content to \" (which normJs folds to an encoded quote). This also repairs
// JSON.parse(`{...}`) of a quoted-JSON template. Interpolation and quote-free templates are regressions.
// Diffed vs Node.
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
  const key = () => ["a", "b", "name", "id", "k"][ri(5)];
  const program = () => {
    const k = key(), v = ri(100), k2 = ri(9);
    if (k2 === 0) return "`{\"" + k + "\":" + v + "}`";
    if (k2 === 1) return "const s=`{\"" + k + "\":" + v + "}`;JSON.parse(s)." + k;
    if (k2 === 2) return "`{\"" + k + "\":${" + v + "+1}}`";
    if (k2 === 3) return "JSON.parse(`{\"" + k + "\":\"str" + v + "\"}`)." + k;
    if (k2 === 4) return "`he said \"" + k + v + "\"`";
    if (k2 === 5) return "`a${" + v + "}b`";                         // regression: interpolation, no quotes
    if (k2 === 6) return "`plain text " + v + "`";                   // regression: no quotes
    if (k2 === 7) return "const o=`{\"" + k + "\":[" + v + "," + (v + 1) + "]}`;JSON.parse(o)." + k + ".length";
    return "`{}`.length";                                            // regression: empty braces
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-templatequote: ${checked} quoted-template programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-templatequote: " + f); process.exit(1); }
