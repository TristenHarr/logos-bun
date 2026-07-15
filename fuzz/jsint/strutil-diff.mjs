// fuzz/jsint/strutil-diff — string utility methods: padStart / padEnd / substring /
// charCodeAt and the global String.fromCharCode, over random ASCII-letter/digit
// strings, each run through logos-bun __js AND Node eval and required to agree.
// Args are simple (literals/arithmetic) — a nested method call inside an arg hits
// the shared naive-`)` arg-extraction limit (see gap#3 in BUGS_FOUND.md).
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
const nodeRun = (p) => String(eval(p));
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const alpha = "abcdefABCDEF0123456789";
  const str = () => { let s = ""; const L = 2 + ri(6); for (let i = 0; i < L; i++) s += alpha[ri(alpha.length)]; return s; };
  const padch = () => ["0", "-", "x", "*"][ri(4)];
  const program = () => {
    const k = ri(6);
    if (k === 0) { const s = str(); return `"${s}".padStart(${ri(10)},"${padch()}")`; }
    if (k === 1) { const s = str(); return `"${s}".padEnd(${ri(10)},"${padch()}")`; }
    if (k === 2) { const s = str(); return `"${s}".substring(${ri(4)},${2 + ri(5)})`; }
    if (k === 3) { const s = str(); return `"${s}".charCodeAt(${ri(s.length)})`; }  // in-range only; OOB→NaN is a NaN-modeling gap
    if (k === 4) return `String.fromCharCode(${65 + ri(20)},${65 + ri(20)},${65 + ri(20)})`;
    return `String.fromCharCode(${65 + ri(20)}+1)`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = nodeRun(p); } catch { continue; }
    ref = String(ref);
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-strutil: ${checked} string-utility programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-strutil: " + f); process.exit(1); }
