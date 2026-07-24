// fuzz/jsint/charcodenewline — charCodeAt/codePointAt over strings containing NEWLINES. A string value
// stores its newline as encNewline (chr31) internally (to keep it from acting as a statement separator),
// so charCodeAt/codePointAt returned 31 instead of 10 for a `\n`. Fixed by decoding the receiver
// (decodeStr maps encNewline→chr10, and is a no-op on already-raw bytes like space/tab) before the char
// read. Exercises the newline character code at various positions plus the common newline-counting loop,
// with plain ASCII text (unicode/multibyte is a separate keystone and avoided here), diffed vs Node.
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
  // an ASCII string with embedded newlines (as \n), no unicode
  const mkStr = () => {
    const words = ["ab", "cd", "ef", "gh", "12", "xy"];
    return Array.from({ length: 2 + ri(4) }, () => words[ri(words.length)]).join("\\n");
  };
  const program = () => {
    const s = mkStr(), k = ri(5);
    if (k === 0) { const lit = JSON.stringify(s.replace(/\\n/g, "\n")); return `(function(){const s=${lit};return s.charCodeAt(${ri(6)})})()`; }
    if (k === 1) { const lit = JSON.stringify(s.replace(/\\n/g, "\n")); return `(function(){const s=${lit};let n=0;for(let i=0;i<s.length;i++)if(s.charCodeAt(i)===10)n++;return n})()`; }
    if (k === 2) { const lit = JSON.stringify(s.replace(/\\n/g, "\n")); return `(function(){const s=${lit};return s.codePointAt(${ri(6)})})()`; }
    if (k === 3) { const lit = JSON.stringify(s.replace(/\\n/g, "\n")); return `(function(){const s=${lit};return s.split("\\n").length})()`; }
    return `(function(){return "Hello".charCodeAt(${ri(5)})})()`; // regression: plain ascii
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-charcodenewline: ${checked} charCodeAt/codePointAt-over-newline programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-charcodenewline: " + f); process.exit(1); }
