// fuzz/jsint/multibyte — non-ASCII source (guillemets «», accents, arrows) in strings/comments FOLLOWED
// by a regex literal, a division, or a comment. The normalization scanners (convertQuotes / desugarRegexLits
// / rxLineEnd / rxBlockEnd / rxBodyEnd / rxLastSigIdx) walk the source by CHARACTER, so their bounds must be
// the char length, not the byte length — otherwise a multi-byte char earlier in the source lets a later
// regex/comment scan index past the last character and panic. test262's assert.js carries «»-bearing
// failure messages, so this bit nearly every test that also had a `/`. Diffed vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const NODE = "node";
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const run = (bin, dir, args) => { const r = spawnSync(bin, args, { encoding: "utf8", cwd: dir, timeout: 5000 }); return ((r.stdout || "") + (r.status ? "\n<exit:" + r.status + ">" : "")).trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const glyph = () => ["«»", "café", "naïve", "→←", "«N»", "Ⅻ", "über", "résumé"][ri(8)];
  // Scope: the NORMALIZATION class — multi-byte source (strings/comments) followed by a division `/`, a
  // comment, or a regex LITERAL being parsed, plus regexes matched against ASCII subjects. Matching a
  // regex against a multi-byte SUBJECT is a separate matcher byte-vs-char issue (its own fuzzer).
  const program = () => {
    const a = 1 + ri(20), b = 1 + ri(9), g = glyph(), k = ri(8);
    if (k === 0) return `var msg = "${g}${a}";\nconsole.log(msg.length, ${a} / ${b} | 0);`;
    if (k === 1) return `// comment with ${g} glyphs\nconsole.log(${a} / ${b} | 0, "${g}");`;
    if (k === 2) return `/* block ${g} comment */\nvar re = /a+/;\nconsole.log(re.test("aaa"), ${a});`;
    if (k === 3) return `console.log("Expected «" + ${a} + "» got «" + ${b} + "»");\nconsole.log(${a} / ${b} | 0);`;
    if (k === 4) return `var x = "${g}"; var y = /\\d/;\nconsole.log(x.length >= 1, y.test("${a}"));`;
    if (k === 5) return `var s = "${g}"; console.log(s.replace("${g}", "X"), ${a} / ${b} | 0);`;
    if (k === 6) return `var t = "${g} ${g}";\nconsole.log(t.split(" ").length, ${a} % ${b});`;
    return `console.log("${g}".length + ${a} / ${b} * 0);\nconsole.log(/x/.test("xyz"), "${g}");`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "mbf-"));
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-multibyte: ${checked} multi-byte+regex programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-multibyte: " + f); process.exit(1); }
