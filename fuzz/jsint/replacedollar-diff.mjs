// fuzz/jsint/replacedollar — the `$` replacement patterns in String.replace/replaceAll with a STRING
// search: $& = the matched substring, $$ = a literal $; $1.. stay literal (a string search has no capture
// groups). Previously the replacement was spliced verbatim so `$&`/`$$` leaked through. Regex .replace
// (which already handled backrefs) and plain no-$ replacements are regression controls. Diffed vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dir = OURS ? mkdtempSync(join(tmpdir(), "rd-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const subjects = ["abc", "a.b.c", "hello world", "x-y-z", "cat"];
  const needles = ["a", "b", ".", "-", "o", "cat", " "];
  // a replacement template containing $ patterns
  const repls = ["$&", "$$", "[$&]", "$&$&", "<$&>", "$1", "$100", "$$5", "end$", "$& and $&", "X"];
  const subj = () => subjects[ri(subjects.length)];
  const needle = () => needles[ri(needles.length)];
  const repl = () => repls[ri(repls.length)];
  const program = () => {
    const s = JSON.stringify(subj()), a = JSON.stringify(needle()), b = JSON.stringify(repl());
    const k = ri(4);
    if (k === 0) return `console.log(${s}.replace(${a},${b}))`;
    if (k === 1) return `console.log(${s}.replaceAll(${a},${b}))`;
    if (k === 2) return `console.log(${s}.replace(${a},"Z"))`;                 // no-$ control
    return `console.log(${s}.replace(new RegExp("[abc]","g"),${b}))`;          // regex control ($& works, $1 no group)
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    const ref = runFile("node", p);
    const got = runFile(OURS, p);
    if (got !== ref) fails.push(`run(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  rmSync(dir, { recursive: true, force: true });
  if (!fails.length) console.log(`PASS jsint-replacedollar: ${checked} replace-$ programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-replacedollar: " + f); process.exit(1); }
