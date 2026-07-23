// fuzz/jsint/objbracket — computed/string-key assignment on an object: o[key]=v. The assign path
// always treated a bracket target as an ARRAY index (safeInt(key)+arrSetIdx), so an object with a
// string/computed key failed (and a non-numeric key PANICKED). It now branches on the receiver type:
// object -> objSet(key), array -> arrSetIdx. Array index assignment is the regression guard; the
// reduce-accumulator (group/count) pattern is the headline.
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
  const items = () => "[" + Array.from({ length: 1 + ri(4) }, () => JSON.stringify("abc"[ri(3)])).join(",") + "]";
  const program = () => {
    const k = ri(4);
    if (k === 0) { const key = "xyz"[ri(3)], v = ri(9); return `(function(){let o={};o[${JSON.stringify(key)}]=${v};return o.${key}})()`; }
    if (k === 1) return `JSON.stringify(${items()}.reduce((o,w)=>{o[w]=(o[w]||0)+1;return o},{}))`;
    if (k === 2) { const key = ri(5), v = ri(9); return `(function(){let a=[0,0,0,0,0];a[${key}]=${v};return a[${key}]})()`; }
    return `(function(){let o={};let k=${JSON.stringify("pq"[ri(2)])};o[k]=${ri(9)};return o[k]})()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-objbracket: ${checked} bracket-assign programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-objbracket: " + f); process.exit(1); }
