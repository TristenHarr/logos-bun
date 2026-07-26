// fuzz/jsint/promiseany — Promise.any([...]) (ES2021). Was unimplemented (evaluated to NaN); now fulfills
// with the first fulfilled element (a non-promise element is its own value), and if every element rejects
// it rejects with an AggregateError whose .errors holds each rejection reason (.message = "All promises
// were rejected"). Promise.all/race are regression controls. Diffed vs Node (`bun run`).
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dir = OURS ? mkdtempSync(join(tmpdir(), "pa-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  // an element: a resolved promise, a rejected promise, or a bare value
  const elem = () => { const t = ri(3); const v = ri(50); if (t === 0) return `Promise.resolve(${v})`; if (t === 1) return `Promise.reject(${v})`; return `${v}`; };
  const list = () => "[" + Array.from({ length: 1 + ri(4) }, elem).join(",") + "]";
  const allRej = () => "[" + Array.from({ length: 1 + ri(3) }, () => `Promise.reject(${ri(50)})`).join(",") + "]";
  const program = () => {
    const k = ri(6);
    if (k === 0) return `Promise.any(${list()}).then(v=>console.log("ok:"+v),e=>console.log("agg:"+JSON.stringify(e.errors)))`;
    if (k === 1) return `Promise.any(${allRej()}).catch(e=>console.log(e.name+"|"+e.message+"|"+JSON.stringify(e.errors)))`;
    if (k === 2) return `(async()=>{try{const v=await Promise.any(${list()});console.log("v="+v)}catch(e){console.log("err="+e.name)}})()`;
    if (k === 3) return `Promise.any([Promise.reject(1),${ri(9)}]).then(v=>console.log(v))`;  // non-promise wins
    if (k === 4) return `Promise.all(${"[" + Array.from({ length: 1 + ri(3) }, () => `Promise.resolve(${ri(9)})`).join(",") + "]"}).then(a=>console.log(a.join(",")))`;  // control
    return `Promise.race([Promise.resolve(${ri(9)}),Promise.resolve(${ri(9)})]).then(v=>console.log(v))`;  // control
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    const ref = runFile("node", p);
    const got = runFile(OURS, p);
    if (got !== ref) fails.push(`run(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  rmSync(dir, { recursive: true, force: true });
  if (!fails.length) console.log(`PASS jsint-promiseany: ${checked} Promise.any programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-promiseany: " + f); process.exit(1); }
