// fuzz/jsint/wordboundary — the \b / \B word-boundary assertions. Added them to mh (atWordBoundary), and
// refactored the global-regex loops (reReplaceLoop, reFindAllLoop, reMatchAllLoop, reReplaceFnLoop) to keep
// the FULL text and thread an absolute position instead of slicing off each match — so a \b/\B/$ at a
// mid-word slice point sees its real neighbours, and a zero-width global match advances one char. This
// fuzzer runs \b/\B in test, global match, matchAll, string replace, and callback replace over mixed
// subjects, plus \b-anchored words and non-\b regressions, vs Node.
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
  const word = () => "abcdef".slice(0, 1 + ri(5));
  const subj = () => Array.from({ length: 2 + ri(4) }, word).join(" ");
  const program = () => {
    const s = JSON.stringify(subj());
    const k = ri(7);
    if (k === 0) return `(function(){ return ${s}.replace(/\\b\\w/g, c=>c.toUpperCase()) })()`;
    if (k === 1) return `(function(){ return ${s}.replace(/\\B/g, ".") })()`;
    if (k === 2) return `(function(){ let m=${s}.match(/\\b\\w+/g); return m?m.length:0 })()`;
    if (k === 3) return `(function(){ return [...${s}.matchAll(/\\b\\w/g)].map(m=>m[0]).join("") })()`;
    if (k === 4) return `(function(){ return /\\b${word()}\\b/.test(${s}) })()`;
    if (k === 5) return `(function(){ return ${s}.replace(/\\w+/g, m=>m.length).length })()`;
    return `(function(){ return ${s}.replace(/\\b\\w+\\b/g, w=>"["+w+"]") })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-wordboundary: ${checked} word-boundary programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-wordboundary: " + f); process.exit(1); }
