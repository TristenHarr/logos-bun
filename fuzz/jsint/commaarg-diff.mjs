// fuzz/jsint/commaarg — a comma that is string CONTENT in the FIRST of a two-argument method,
// e.g. replace(",", x) / replaceAll(",", x). splitArgs2 split the arg list with the string-BLIND
// topCommaIdx, which stopped at that content comma and mangled the args (the search never matched, so
// "a,b,c".replaceAll(",","-") returned unchanged). splitArgs2 now reuses commaDepthSplit — the same
// string/bracket/brace-aware scanner splitArgsN uses — so only a genuine top-level separator comma
// splits the two args. Covers replace/replaceAll/padStart/padEnd/slice with commas (and other punct)
// in either argument. Diffed vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 260), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const seps = [",", ";", ".", " ", "-", "|"];
  const csv = () => ["a", "b", "c", "d"].slice(0, 2 + ri(3)).join(seps[ri(seps.length)]);
  const program = () => {
    const s = csv(), a = seps[ri(seps.length)], b = seps[ri(seps.length)], k = ri(6);
    if (k === 0) return `${JSON.stringify(s)}.replaceAll(${JSON.stringify(a)},${JSON.stringify(b)})`;
    if (k === 1) return `${JSON.stringify(s)}.replace(${JSON.stringify(a)},${JSON.stringify(b)})`;
    if (k === 2) return `"x".padStart(${2 + ri(4)},${JSON.stringify(a)})`;
    if (k === 3) return `${JSON.stringify(s)}.padEnd(${8 + ri(3)},${JSON.stringify(a)})`;
    if (k === 4) return `${JSON.stringify(s)}.split(${JSON.stringify(a)}).length`;   // 1-arg regression
    return `${JSON.stringify(s)}.slice(1,3)`;                                          // 2-arg numeric regression
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String((0, eval)(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-commaarg: ${checked} comma-in-arg programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-commaarg: " + f); process.exit(1); }
