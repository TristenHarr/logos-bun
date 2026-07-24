// fuzz/jsint/regexci — the regex `i` (case-insensitive) flag. The backtracking matcher's atom/class
// comparisons were case-sensitive with no way to fold. Added a thread-local case-fold flag (native
// reCiSet/reCiGet) that each match entry point sets from the pattern's flags and the two comparison points
// (atomMatches literal, and the character class via testing both cases of the input char) read. This fuzzer
// runs test/match/replace/split with and without the i flag over mixed-case subjects and literal/class/range
// patterns, and diffs vs Node — the non-i cases guard that case-sensitive matching is unchanged.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const letters = "abcABCxyzXYZ";
  const mkSubject = () => Array.from({ length: 3 + ri(6) }, () => letters[ri(letters.length)] + (ri(3) === 0 ? String(ri(9)) : "")).join("");
  const patterns = ["[a-c]", "[A-Z]", "[a-z]", "x", "B", "[xyz]"];
  const program = () => {
    const subj = JSON.stringify(mkSubject());
    const pat = patterns[ri(patterns.length)];
    const iFlag = ri(2) ? "i" : "";
    const k = ri(4);
    if (k === 0) return `(function(){ return /${pat}/${iFlag}.test(${subj}) })()`;
    if (k === 1) return `(function(){ let m=${subj}.match(/${pat}/g${iFlag}); return m?m.length:0 })()`;
    if (k === 2) return `(function(){ return ${subj}.replace(/${pat}/g${iFlag}, "*") })()`;
    return `(function(){ return ${subj}.split(/${pat}/${iFlag}).join("|") })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-regexci: ${checked} case-insensitive-flag programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-regexci: " + f); process.exit(1); }
