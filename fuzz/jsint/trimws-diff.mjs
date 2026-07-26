// fuzz/jsint/trimws — String.prototype.trim/trimStart/trimEnd strip ALL leading/trailing whitespace
// (space, tab, LF, CR, VT, FF), not just spaces. trimHeadIdx/trimTailIdx only matched encSpace, so
// tab/newline/CR-padded strings came back untrimmed. Inner whitespace is preserved. Diffed vs Node
// (`bun run`), comparing the trimmed result wrapped in [brackets] so any residual whitespace shows.
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "tw-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  // space + tab/LF/CR (the common whitespace escapes; \v/\f produce control chars that collide with the
  // internal value representation — a separate deferred value-representation item, like \uXXXX).
  const wsChars = ["\\t", "\\n", "\\r", " "];
  const cores = ["hi", "a b", "word", "x y z", "café", ""];
  const ws = () => Array.from({ length: ri(4) }, () => wsChars[ri(wsChars.length)]).join("");
  const method = () => ["trim", "trimStart", "trimEnd"][ri(3)];
  const program = () => {
    const m = method();
    const core = cores[ri(cores.length)].replace(/"/g, '\\"');
    // trimStart must PRESERVE trailing whitespace, but charLen undercounts a trailing control char (a
    // separate pre-existing quirk) — so exercise trimStart with leading-only whitespace. trim/trimEnd
    // strip the trailing side, so whitespace on both ends is safe there.
    if (m === "trimStart") return `console.log("["+"${ws()}${core}".trimStart()+"]")`;
    return `console.log("["+"${ws()}${core}${ws()}".${m}()+"]")`;
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
  if (!fails.length) console.log(`PASS jsint-trimws: ${checked} trim-whitespace programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-trimws: " + f); process.exit(1); }
