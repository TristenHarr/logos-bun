// fuzz/jsint/anchoralt — the ^ and $ anchors inside an alternation. reSearchStart/reTest/reMatchEnd treated
// a leading ^ as anchoring the WHOLE pattern, so `/^\s+|\s+$/g` only stripped the leading run (the `\s+$`
// branch's $ never got a chance). Moved ^ into mh as an anchor atom (matches only at position 1) and dropped
// the whole-pattern ^ special-casing, so each alternative is anchored independently. This fuzzer exercises
// trim-style `^X+|X+$`, standalone ^/$ anchors, and `^...$` full-match tests over padded subjects vs Node.
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
  const pad = () => "x".repeat(ri(4));
  const core = () => "abcdef".slice(0, 1 + ri(5));
  const program = () => {
    const k = ri(5);
    if (k === 0) { const s = JSON.stringify(pad() + core() + pad()); return `(function(){ return ${s}.replace(/^x+|x+$/g,"") })()`; }
    if (k === 1) { const s = JSON.stringify(pad() + core()); return `(function(){ return ${s}.replace(/^x+/,"") })()`; }
    if (k === 2) { const s = JSON.stringify(core() + pad()); return `(function(){ return ${s}.replace(/x+$/,"") })()`; }
    if (k === 3) { const s = JSON.stringify(core() + String(ri(99))); return `(function(){ return /^[a-z]+\\d+$/.test(${s}) })()`; }
    const s = JSON.stringify(core()); return `(function(){ let m=${s}.match(/^[a-z]+$/); return m?m[0]:"null" })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-anchoralt: ${checked} anchor-in-alternation programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-anchoralt: " + f); process.exit(1); }
