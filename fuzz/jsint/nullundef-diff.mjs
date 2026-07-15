// fuzz/jsint/nullundef-diff — the P7 JS engine's `null` and `undefined` as
// first-class values, differential-fuzzed vs Node eval. Bare literals, stored in
// variables, their typeof (null→"object", undefined→"undefined"), and the two
// ways undefined arises structurally: a missing object key (o.missing) and an
// out-of-bounds array index (a[N]). Both now yield a real `undefined` (previously
// a missing key was a chr3-tagged "undefined" string, so typeof mis-reported
// "string"). String(null)="null", String(undefined)="undefined".
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
const nodeRun = (p) => { const parts = p.split(";"); const body = parts.slice(0, -1).map((s) => s + ";").join("") + " return (" + parts[parts.length - 1] + ");"; return eval("(()=>{" + body + "})()"); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 500), rnd = mul(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const program = () => {
    const k = rnd();
    if (k < 0.2) return pick(["null", "undefined"]);                                 // bare literal
    if (k < 0.4) { const v = pick(["null", "undefined"]); return `let x=${v};x`; }    // stored
    if (k < 0.6) { const v = pick(["null", "undefined"]); return `typeof ${v}`; }     // typeof of a literal
    if (k < 0.72) { const v = pick(["null", "undefined"]); return `let x=${v};typeof x`; } // typeof of a variable
    if (k < 0.84) { const c = 1 + Math.floor(rnd() * 3); const ks = ["k0", "k1", "k2"].slice(0, c); return `let o={${ks.map((kk, i) => `${kk}:${i + 1}`).join(",")}};o.k9`; } // missing key
    if (k < 0.92) { const c = 1 + Math.floor(rnd() * 3); const ks = ["k0", "k1", "k2"].slice(0, c); return `let o={${ks.map((kk, i) => `${kk}:${i + 1}`).join(",")}};typeof o.k9`; } // typeof missing key
    const len = 1 + Math.floor(rnd() * 3); const arr = "[" + Array.from({ length: len }, () => Math.floor(rnd() * 9)).join(",") + "]"; const idx = len + Math.floor(rnd() * 3); return rnd() < 0.5 ? `${arr}[${idx}]` : `typeof ${arr}[${idx}]`; // OOB index (+ typeof)
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
  if (!fails.length) console.log(`PASS jsint-nullundef: ${checked} null/undefined programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL jsint-nullundef: " + f); process.exit(1); }
