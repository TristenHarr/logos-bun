// fuzz/jsint/jsonstringesc — JSON string ESCAPE resolution in JSON.parse. A parsed string kept its escape
// sequences literally: `JSON.parse('"a\\"b"')` returned `a\"b`, not `a"b`. Fixed jsonParse to unescape the
// whitespace-free string content escapes (`\"`→", `\\`→\, `\/`→/, `\b`), and taught jsonSplitTop to skip
// escaped chars so an escaped quote inside a value doesn't prematurely end the string during structural
// splitting. The whitespace escapes `\n`/`\t`/`\r`/`\f` are intentionally left intact — they materialize
// chr10/chr9/chr13/chr12, which collide with the object/array entry separator, the env escape, and value
// whitespace-trimming (a pre-existing value-representation limitation) — so this fuzzer avoids them.
// Exercises escaped quotes/backslashes/slashes at top level, inside objects, and inside arrays, plus
// stringify→parse round-trips, diffed vs Node.
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
  // a JS string containing only whitespace-free safe escapables (quote/backslash/slash) + letters
  const mkStr = () => {
    const parts = ["a", "b", "c", '"', "\\", "/", "z", "1"];
    return Array.from({ length: 1 + ri(5) }, () => parts[ri(parts.length)]).join("");
  };
  const program = () => {
    const s = mkStr(), k = ri(6);
    if (k === 0) return `(function(){return JSON.parse(${JSON.stringify(JSON.stringify(s))})})()`;                        // top-level string
    if (k === 1) return `(function(){const o=JSON.parse(${JSON.stringify(JSON.stringify({ x: s }))});return o.x})()`;      // string in object
    if (k === 2) return `(function(){const a=JSON.parse(${JSON.stringify(JSON.stringify([s, "tail"]))});return a[0]+"|"+a[1]})()`; // string in array
    if (k === 3) return `(function(){return JSON.parse(JSON.stringify(${JSON.stringify(s)}))})()`;                        // round-trip
    if (k === 4) return `(function(){const o=JSON.parse(JSON.stringify({a:${JSON.stringify(s)},b:${ri(99)}}));return o.a+"#"+o.b})()`; // round-trip in object w/ 2nd key
    return `(function(){return JSON.parse(${JSON.stringify(JSON.stringify(s))}).length})()`;                              // length
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-jsonstringesc: ${checked} JSON string-escape programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-jsonstringesc: " + f); process.exit(1); }
