// fuzz/jsint/strsearch — String.prototype.search(regexp|string). It was unimplemented (numeric-coerced
// to NaN); now returns the 0-based index of the first match or -1, reusing the existing regex search
// engine (reSearchStart) via reSearchIndex. A non-regex argument is coerced to a RegExp (so "." matches
// any char, like Node). Honors the `i` flag and ^/$ anchors. Diffed vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 260), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const words = ["hello world", "the year 2020", "a1b2c3", "CamelCase", "12:34:56", "foo_bar", "abcABC", "", "x", "no digits here"];
  const pats = ["/\\d/", "/\\d{2}/", "/[a-z]+/", "/[A-Z]/", "/o/", "/:/", "/^a/", "/z$/", "/_/", "/\\s/"];
  const program = () => {
    const w = words[ri(words.length)], k = ri(4);
    if (k === 0) return `${JSON.stringify(w)}.search(${pats[ri(pats.length)]})`;
    if (k === 1) return `${JSON.stringify(w)}.search(/l/i)`;
    if (k === 2) return `${JSON.stringify(w)}.search(${JSON.stringify(w.slice(1, 3) || "x")})`;   // string arg → coerced
    return `let s=${JSON.stringify(w)};s.search(/[a-z]/)`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String((0, eval)(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-strsearch: ${checked} String.search programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-strsearch: " + f); process.exit(1); }
