// fuzz/jsint/fncallback — a bare unary global function used as an array callback (.map(Number),
// .filter(Boolean), .map(String), .map(parseFloat)). Was broken (returned empty/NaN) because the
// callback machinery only understood arrow/function literals. Arrow callbacks are the regression guard.
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
  const numArr = () => "[" + Array.from({ length: 1 + ri(4) }, () => JSON.stringify(String(ri(9)) + (ri(2) ? "." + ri(9) : ""))).join(",") + "]";
  const mixArr = () => "[" + Array.from({ length: 1 + ri(4) }, () => [ "0", "1", JSON.stringify(""), JSON.stringify("x"), "2" ][ri(5)]).join(",") + "]";
  const cb = () => ["Number", "String", "Boolean", "parseFloat"][ri(4)];
  const program = () => {
    const k = ri(3);
    if (k === 0) return `${numArr()}.map(${cb()}).join("|")`;
    if (k === 1) return `${mixArr()}.filter(Boolean).join(",")`;
    return `${mixArr()}.map(x=>x).join(",")`;   // arrow regression guard
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-fncallback: ${checked} callback programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-fncallback: " + f); process.exit(1); }
