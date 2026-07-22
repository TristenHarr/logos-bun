// fuzz/jsint/replacefn-diff — String.replace(regex, fn): the replacement is a callback invoked per
// match (match bound to param 1), and its returned string is spliced in. Covers inline and named
// replacers, wrapping the match with structural characters ([]/()/{}) — which exercises the re-encode
// of the decoded regex-replace result — and per-match case transforms, first-match vs global. Diffed
// vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const NODE = process.execPath;
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dir = mkdtempSync(join(tmpdir(), "repfn-"));
const runFile = (bin, src) => { const f = join(dir, "r.js"); writeFileSync(f, src); const r = spawnSync(bin, ["run", f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
const runNode = (src) => { const f = join(dir, "n.js"); writeFileSync(f, src); const r = spawnSync(NODE, [f], { encoding: "utf8" }); return (r.stdout || "").trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const words = ["a1b2c3", "hello", "x9y8", "Foo Bar", "12ab34"];
  const J = (x) => JSON.stringify(x);
  const w = () => words[ri(words.length)];
  const wraps = [["[", "]"], ["(", ")"], ["{", "}"], ["<", ">"], ["_", "_"]];
  const program = () => {
    const k = ri(5), s = w(), [l, r] = wraps[ri(wraps.length)];
    if (k === 0) return `console.log(${J(s)}.replace(/\\d/g,m=>${J(l)}+m+${J(r)}));`;
    if (k === 1) return `console.log(${J(s)}.replace(/[a-z]/g,c=>c.toUpperCase()));`;
    if (k === 2) return `console.log(${J(s)}.replace(/\\w/,m=>"#"));`;
    if (k === 3) return `let f=m=>${J(l)}+m+${J(r)};console.log(${J(s)}.replace(/\\d/g,f));`;
    return `console.log(${J(s)}.replace(/[A-Z]/g,c=>c.toLowerCase()));`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const src = program();
    const ref = runNode(src);
    const got = runFile(OURS, src);
    if (got !== ref) fails.push(`run(${J(src)}): ours=${J(got)} node=${J(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-replacefn: ${checked} replace-with-function programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-replacefn: " + f); process.exit(1); }
