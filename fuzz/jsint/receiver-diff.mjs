// fuzz/jsint/receiver-diff — method RECEIVERS beyond a bare variable: an array
// LITERAL (`[1,2,3].map(...)`), an INDEX (`arr[i].toUpperCase()`), and a
// PARENTHESIZED expression (`(""+n).padStart(...)`, `("a"+"b").toUpperCase()`).
// All route through the balanced receiver extractor (recvStart/recvExpr). Each
// program runs through logos-bun __js AND Node eval and must agree.
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
  const sn = () => 1 + ri(9);
  const lit = () => "[" + Array.from({ length: 3 + ri(3) }, () => sn()).join(",") + "]";
  const words = ["cat", "dog", "fox", "owl", "bee", "ant"];
  const wlit = () => "[" + Array.from({ length: 2 + ri(3) }, () => `"${words[ri(words.length)]}"`).join(",") + "]";
  const program = () => {
    const k = ri(9);
    if (k === 0) return `${lit()}.map(x=>x*2).join(",")`;                       // array-literal receiver
    if (k === 1) { const t = sn(); return `${lit()}.filter(x=>x>${t}).length`; }
    if (k === 2) return `${lit()}.reduce((s,x)=>s+x,0)`;
    if (k === 3) return `${lit()}.join("-")`;
    if (k === 4) { const arr = lit(); const idx = ri(3); return `${arr}.slice(${idx},${idx + 2}).join(",")`; }
    if (k === 5) { const arr = wlit(); return `${arr}[0].toUpperCase()`; }       // index receiver
    if (k === 6) { const arr = wlit(); return `${arr}[1].length`; }
    if (k === 7) return `("${words[ri(6)]}"+"${words[ri(6)]}").toUpperCase()`;    // paren-expr receiver
    return `(""+${10 + ri(90)}).padStart(5,"0")`;
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
  if (!fails.length) console.log(`PASS jsint-receiver: ${checked} receiver programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-receiver: " + f); process.exit(1); }
