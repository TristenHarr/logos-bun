// fuzz/jsint/normalize — String.prototype.normalize. For text already in NFC (every source
// literal here), `.normalize()`/`.normalize("NFC")`/`.normalize("NFKC")` is the identity, so the
// engine returns the receiver string unchanged. The pool is plain words + PRECOMPOSED Latin-1
// accents (café/über/naïve/résumé), where NFC == NFKC == identity; the value round-trips and
// chains (.length is code-point count, .toUpperCase Latin-1-cased, === and + operate on the
// normalized value). NFD/NFKD (which DECOMPOSE precomposed chars) are intentionally NOT exercised —
// canonical decomposition needs the Unicode decomposition table and is a documented follow-up.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const word = () => ["café", "über", "naïve", "résumé", "hello", "ÑOÑO", "Zürich", "señor", "abc"][ri(9)];
  const form = () => ["", '"NFC"', '"NFKC"'][ri(3)];              // identity forms only
  const program = () => {
    const w = word(), f = form(), k = ri(6);
    if (k === 0) return `"${w}".normalize(${f})`;
    if (k === 1) return `"${w}".normalize(${f}).length`;
    if (k === 2) return `"${w}".normalize(${f})==="${w}"`;
    if (k === 3) return `"${w}".normalize(${f}).toUpperCase()`;
    if (k === 4) return `("<"+"${w}".normalize(${f})+">")`;
    return `"${w}".normalize(${f}).charCodeAt(0)`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-normalize: ${checked} normalize (NFC/NFKC identity) programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-normalize: " + f); process.exit(1); }
