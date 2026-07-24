// fuzz/jsint/stringifyindent — JSON.stringify's third argument (the indent). The dispatch evaluated the
// whole arg text as one expression, so `JSON.stringify(x, null, 2)` mis-parsed → NaN. Rewrote it to split
// the args and, when a third (indent) arg is present, pretty-print via jsonStrInd: each object/array
// member on its own line at the accumulated indent, a colon followed by one space, empty {}/[] on one
// line. A number indent is min(10,n) spaces; a string indent is its first 10 chars. This fuzzer builds
// random nested structures and stringifies them with 0/2/4/tab indents, comparing the full output vs Node.
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
  // build a random JSON-safe value literal (bounded depth) as source text
  const mkVal = (d) => {
    const k = ri(d <= 0 ? 3 : 6);
    if (k === 0) return String(ri(100));
    if (k === 1) return JSON.stringify("s" + ri(50));
    if (k === 2) return ri(2) ? "true" : "false";
    if (k === 3) return `[${Array.from({ length: ri(4) }, () => mkVal(d - 1)).join(",")}]`;
    return `{${Array.from({ length: 1 + ri(3) }, (_, i) => `k${i}:${mkVal(d - 1)}`).join(",")}}`;
  };
  const indents = ["2", "4", "0", '"  "', '"\\t"', "null"];
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const v = mkVal(2 + ri(2));
    const ind = indents[ri(indents.length)];
    const p = `(function(){ return JSON.stringify(${v}, null, ${ind}) })()`;
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-stringifyindent: ${checked} indented-stringify programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-stringifyindent: " + f); process.exit(1); }
