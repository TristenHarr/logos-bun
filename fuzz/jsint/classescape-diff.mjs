// fuzz/jsint/classescape — escape classes inside a character class: [\w], [\d], [\s] (and negations, mixed
// with literals like [\w.], [\w-]). classContains treated `\` as a literal, so [\w] never matched a word
// char; classEnd also didn't skip `\X`. Added escape handling in classContains (\w/\d/\s via escapeMatches)
// and `\X` skipping in classEnd. This fuzzer builds character classes mixing escape classes with literals
// and ranges, over mixed subjects, and checks test/match/replace vs Node.
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
  const subj = () => Array.from({ length: 3 + ri(8) }, () => "ab12 .-_XY"[ri(10)]).join("");
  const classes = ["[\\w]", "[\\d]", "[\\s]", "[\\w.]", "[\\w-]", "[\\d.]", "[^\\d]", "[^\\w]", "[a-z\\d]"];
  const program = () => {
    const s = JSON.stringify(subj());
    const cls = classes[ri(classes.length)];
    const k = ri(4);
    if (k === 0) return `(function(){ return /${cls}/.test(${s}) })()`;
    if (k === 1) return `(function(){ let m=${s}.match(/${cls}+/); return m?m[0]:"null" })()`;
    if (k === 2) return `(function(){ let m=${s}.match(/${cls}/g); return m?m.length:0 })()`;
    return `(function(){ return ${s}.replace(/${cls}/g, "*") })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-classescape: ${checked} char-class-escape programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-classescape: " + f); process.exit(1); }
