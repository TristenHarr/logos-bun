// fuzz/glob/match-diff — differential fuzzer for logos-bun's segment-level glob
// matcher against minimatch (the de-facto Node glob reference). Covers the
// fnmatch core `*` (any run) / `?` (one char) / literals over a single path
// segment (no `/`). Globstar `**`, char classes `[...]`, and braces `{}` are
// later increments; the pattern generator stays inside the implemented subset.
//
// minimatch runs with {dot:true} so `*`/`?` match a leading dot (aligning with
// our dot-agnostic matcher), and with brace/ext/negate/comment OFF so no
// unsupported syntax enters. Excluded from the corpus (minimatch bundles
// FILESYSTEM rules our pure fnmatch matcher intentionally doesn't): the empty
// segment (`*`-vs-"" is minimatch's degenerate case) and the `.`/`..` directory
// entries (minimatch never matches those via a wildcard, even with {dot:true}).
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { minimatch } from "minimatch";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(dir, out = []) {
  let es; try { es = readdirSync(dir); } catch { return out; }
  for (const e of es) {
    const p = join(dir, e); let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) findBin(p, out);
    else if (e === "bun" && st.mode & 0o111) out.push(p);
  }
  return out;
}
const OURS = findBin(join(ROOT, "target"))
  .filter((p) => !/vendor|oracle/.test(p))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];

const MM = { dot: true, nobrace: true, noext: true, nonegate: true, nocomment: true };
const fails = [];
if (!OURS) fails.push("no logos-bun binary under target/ — build it first");

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ours = (pat, txt) => {
  const r = spawnSync(OURS, ["__glob", pat, txt], { encoding: "utf8" });
  if (r.status !== 0) return `ERR:${r.status}`;
  return (r.stdout || "").trim();
};

if (OURS) {
  const seed = Number(process.argv[2] || 20260714);
  const n = Number(process.argv[3] || 800);
  const rnd = mulberry32(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const alpha = "abc.12";
  const literal = () => pick(alpha.split(""));
  const text = () => {
    const len = 1 + Math.floor(rnd() * 7);
    return Array.from({ length: len }, literal).join("");
  };
  // A well-formed char class over [abc12] — singles, a range, optional negation
  // ([!..]/[^..]). Biased to INCLUDE `want` (so it matches) when one is given.
  const clsChars = "abc12";
  const cls = (want) => {
    const neg = rnd() < 0.35;
    let members = rnd() < 0.4 ? pick(["a-c", "1-2", "a-c", "b-c"])
      : Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => pick(clsChars.split(""))).join("");
    // for a POSITIVE class, fold `want` in so the pair is a match (density);
    // for a NEGATIVE class, leaving it out also makes a match.
    if (want && !neg && "abc12".includes(want) && !members.includes(want) && !members.includes("-"))
      members += want;
    return `[${neg ? pick(["!", "^"]) : ""}${members}]`;
  };
  // A pattern DERIVED from a text (replace some chars with * / ? / [class]) so
  // matches are dense, plus occasional fully-random patterns for the miss cases.
  const patFrom = (t) => {
    let out = "";
    for (const ch of t) {
      const k = rnd();
      if (k < 0.16) out += "*";
      else if (k < 0.26) out += "?";
      else if (k < 0.42) out += cls(ch);
      else if (k < 0.5) { /* drop the char (only matchable via a neighboring *) */ }
      else out += ch;
    }
    if (out === "") out = "*";
    return out;
  };
  const randPat = () => {
    const len = 1 + Math.floor(rnd() * 6);
    return Array.from({ length: len }, () => {
      const k = rnd();
      return k < 0.22 ? "*" : k < 0.35 ? "?" : k < 0.5 ? cls(null) : literal();
    }).join("");
  };

  const fixed = [
    ["*.ts", "a.ts", true], ["*.ts", "a.js", false], ["foo*", "foo", true],
    ["?ar", "bar", true], ["?ar", "ar", false], ["a*c", "ac", true],
    ["a*b*c", "axbyc", true], ["abc", "abc", true], ["*", "x", true],
  ];
  let checked = 0, hit = 0;
  for (const [p, t] of fixed.map(([p, t]) => [p, t])) {
    const ref = String(minimatch(t, p, MM)); const got = ours(p, t);
    if (got !== ref) fails.push(`glob("${p}", "${t}"): ours=${got} minimatch=${ref}`);
    checked++;
  }
  for (let i = 0; i < n; i++) {
    const t = text();
    const p = rnd() < 0.8 ? patFrom(t) : randPat();
    if (p === "" || t === "" || t === "." || t === "..") continue;
    const ref = String(minimatch(t, p, MM));
    const got = ours(p, t);
    if (got !== ref) fails.push(`glob("${p}", "${t}"): ours=${got} minimatch=${ref}`);
    if (ref === "true") hit++;
    checked++;
  }
  if (!fails.length) console.log(`PASS glob-match: ${checked} pairs agree with minimatch (${hit} matched, seed ${seed})`);
}

if (fails.length) {
  for (const f of fails.slice(0, 25)) console.error("FAIL glob-match: " + f);
  if (fails.length > 25) console.error(`… and ${fails.length - 25} more`);
  process.exit(1);
}
