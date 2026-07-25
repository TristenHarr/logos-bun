// fuzz/jsint/strescape — hex (\xHH) and unicode (\uHHHH) escape sequences in string LITERALS. normJsN
// dropped the backslash for \x/\u (so "\x41" became "x41"); it now reads the following 2 (\x) or 4 (\u)
// hex digits and emits chr(codepoint), and also handles \r. Escapes are generated for printable-ASCII
// codepoints so the decoded output is diffable. Existing \n/\t/\"/\\ escapes and plain strings are
// regressions. (JSON.parse's own \uXXXX decoding is a separate jsonUnescape concern, not exercised.)
// Diffed vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 300), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const hex2 = (n) => n.toString(16).padStart(2, "0");
  const hex4 = (n) => n.toString(16).padStart(4, "0");
  // printable ASCII except quote/backslash so the literal is clean
  const cp = () => { let c; do { c = 0x20 + ri(0x5f); } while (c === 0x22 || c === 0x5c); return c; };
  const xEsc = () => `\\x${hex2(cp())}`;
  const uEsc = () => `\\u${hex4(cp())}`;
  const program = () => {
    const k = ri(8);
    if (k === 0) return `"${xEsc()}${xEsc()}${xEsc()}"`;
    if (k === 1) return `"${uEsc()}${uEsc()}"`;
    if (k === 2) return `"${xEsc()}".charCodeAt(0)`;
    if (k === 3) return `"${uEsc()}".length`;
    if (k === 4) return `"pre${xEsc()}post"`;
    if (k === 5) return `"a\\tb".length`;                 // regression: \t
    if (k === 6) return `"q\\"q".length`;                 // regression: \"
    return `"plain${ri(100)}"`;                           // regression: plain
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-strescape: ${checked} \\x/\\u escape programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-strescape: " + f); process.exit(1); }
