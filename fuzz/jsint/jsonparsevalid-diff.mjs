// fuzz/jsint/jsonparsevalid — JSON.parse now throws SyntaxError on malformed input (it used to silently
// return a partial/garbage value). A validator (jsonValid) scans the raw text — over the ENCODED delimiters
// the string carries (encBraceL/encBrkL/encQuote/encSpace) — and requires exactly one well-formed value
// spanning the whole input; numbers are scanned leniently so no VALID json is ever rejected (safety over
// completeness). This builds random well-formed JSON (nested objects/arrays/strings/numbers/booleans/null,
// with assorted whitespace) and checks it still round-trips, and builds clearly-malformed inputs (unquoted
// key, trailing/double comma, unterminated, `undefined`/`NaN`, missing value) and checks they throw — both
// diffed vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 200), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  // a random JSON-safe value (no escaped chars, to keep clear of the separate unescape gap), bounded depth
  const mk = (d) => {
    const k = ri(d <= 0 ? 4 : 6);
    if (k === 0) return String(ri(1000));
    if (k === 1) return String(-ri(1000));
    if (k === 2) return ["true", "false", "null"][ri(3)];
    if (k === 3) return JSON.stringify("s" + ri(500));
    if (k === 4) return `[${Array.from({ length: ri(4) }, () => mk(d - 1)).join(",")}]`;
    return `{${Array.from({ length: 1 + ri(3) }, (_, i) => `${JSON.stringify("k" + i)}:${mk(d - 1)}`).join(",")}}`;
  };
  const invalids = ["{bad}", "[1,2,", "undefined", "NaN", "{\\\"a\\\":1,}", "[1,,2]", "{\\\"a\\\":}", "[1 2]", "", "{\\\"a\\\" 1}", "tru", "[1,2}"];
  let checked = 0;
  for (let it = 0; it < n; it++) {
    let p;
    if (ri(2) === 0) {
      // valid: random JSON with random whitespace, re-stringified so ordering/format matches
      const v = mk(2 + ri(2));
      const pad = [" ", "  ", "", "\\n"][ri(4)];
      p = `(function(){return JSON.stringify(JSON.parse(${JSON.stringify(pad + v + pad)}))})()`;
    } else {
      const bad = invalids[ri(invalids.length)];
      p = `(function(){try{JSON.parse("${bad}");return "no-throw"}catch(e){return e.name}})()`;
    }
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-jsonparsevalid: ${checked} JSON.parse validity programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-jsonparsevalid: " + f); process.exit(1); }
