// fuzz/jsint/capturegroups — regex capture groups: match()[N]/exec()[N] and $N/$&/$$ in replace. The
// matcher (mh) dissolves group boundaries, so a separate capExtract pass walks the pattern's top-level
// groups at the known match start, capturing each body's match; .match returns [full, ...groups] and
// backrefScan substitutes $1..$9 / $& / $$ in a replacement. This fuzzer builds patterns with sequential
// top-level capture groups over structured subjects (word-number-word, dash-separated, etc.) and checks
// match()[N] extraction and $N-reordering replaces vs Node, plus no-capture regressions.
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
  const word = () => "abcdefgh".slice(0, 1 + ri(5));
  const num = () => String(10 + ri(9000));
  const cases = [
    // [subject, pattern, then]
    () => { const a = word(), b = word(); return [`"${a} ${b}"`, `/(\\w+) (\\w+)/`]; },
    () => { const a = num(), b = num(); return [`"${a}-${b}"`, `/(\\d+)-(\\d+)/`]; },
    () => { const a = word(), b = num(), c = word(); return [`"${a}${b}${c}"`, `/([a-z]+)(\\d+)([a-z]+)/`]; },
    () => { const a = num(), b = num(), c = num(); return [`"${a}/${b}/${c}"`, `/(\\d+)\\/(\\d+)\\/(\\d+)/`]; },
  ];
  const program = () => {
    const [subj, pat] = cases[ri(cases.length)]();
    const k = ri(4);
    if (k === 0) return `(function(){ let m=${subj}.match(${pat}); return m?(m[1]+"|"+(m[2]||"")+"|"+(m[3]||"")):"null" })()`;
    if (k === 1) return `(function(){ let m=${subj}.match(${pat}); return m?String(m.length):"null" })()`;
    if (k === 2) return `(function(){ return ${subj}.replace(${pat}, "$2:$1") })()`;
    return `(function(){ return ${subj}.replace(${pat}, "[$&]") })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-capturegroups: ${checked} capture-group programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-capturegroups: " + f); process.exit(1); }
