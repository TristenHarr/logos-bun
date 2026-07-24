// fuzz/jsint/uricomp — encodeURIComponent / decodeURIComponent (global functions), previously
// unimplemented (→ empty). Added native js_uri_encode (percent-encode the UTF-8 bytes except the
// unreserved set A-Z a-z 0-9 - _ . ! ~ * ' ( )) and js_uri_decode (%XX → byte → UTF-8). The encoded result
// is wrapped in encodeStr so its literal `(`/`)` (kept by encodeURIComponent) don't flow back into the
// evaluator as grouping parens. This fuzzer builds random strings from a mix of unreserved, reserved, and
// space/symbol characters and compares encodeURIComponent, decodeURIComponent, and the round-trip vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 400), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  // a character pool spanning unreserved, reserved delimiters, spaces and assorted ASCII symbols. `;` is
  // excluded: a string VALUE containing a semicolon truncates on output — a separate PRE-EXISTING engine
  // bug (`return "a;b"` → "a", though `"a;b".length` is 3), independent of encode/decodeURIComponent.
  const pool = "abcXYZ019-_.!~*'()% &=?/#:@+$,[]{}|^<>\"".split("");
  const mkStr = () => Array.from({ length: 1 + ri(12) }, () => pool[ri(pool.length)]).join("");
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const s = mkStr();
    const k = ri(3);
    const prog = k === 0 ? `(function(){ return encodeURIComponent(${JSON.stringify(s)}) })()`
      : k === 1 ? `(function(){ return decodeURIComponent(encodeURIComponent(${JSON.stringify(s)})) })()`
      : `(function(){ return decodeURIComponent(${JSON.stringify(encodeURIComponent(s))}) })()`;
    let ref; try { ref = String(eval(prog)); } catch { continue; }
    const got = run(prog);
    if (got !== ref) fails.push(`${prog}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-uricomp: ${checked} encode/decodeURIComponent programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-uricomp: " + f); process.exit(1); }
