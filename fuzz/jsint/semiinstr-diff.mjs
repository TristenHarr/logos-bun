// fuzz/jsint/semiinstr — a semicolon (or brace/paren) INSIDE a string literal must be data, not a
// statement/scope boundary. The statement splitter (splitTop) ignored string literals, so `";".length`
// was 0, `"a;b"` crashed, and `"a=1;b=2".split(";").map(...)` stack-overflowed. Direct expressions
// (no variable binding) are exercised — a value carried through a `let`/return hits a separate,
// deeper env-separator issue and is intentionally not covered here.
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
  const ch = () => "ab;=,{ "[ri(7)] || "a";
  const strLit = () => JSON.stringify(Array.from({ length: 1 + ri(7) }, ch).join(""));
  const program = () => {
    const s = strLit(), k = ri(4);
    if (k === 0) return `${s}.length`;
    if (k === 1) return `${s}.split(";").length`;
    if (k === 2) return `${s}.split(";").map(p=>p.length).join(",")`;
    return `${s}.split(";").join("|")`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-semiinstr: ${checked} semicolon-in-string programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-semiinstr: " + f); process.exit(1); }
