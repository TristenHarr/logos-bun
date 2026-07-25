// fuzz/jsint/iterprotocol — the ES iterator protocol on array/Map/Set .keys()/.values()/.entries().
// Three fixes converge here: (1) those methods now return a real iterator OBJECT (generator-shaped:
// __gen_values + a __gen_idx cursor) so .next()→{value,done} works and advances; (2) a chained method
// after .next().value (it.next().value.join(',')) no longer double-advances the cursor — the built-in
// .next() dispatch runs before resolveMethods' speculative receiver probe; (3) an inline literal
// receiver inside a spread ([...[1,2,3].keys()], [...[1,2].map(f)]) resolves its trailing method,
// because recvStart now treats `...` as a boundary token. Diffed vs Node.
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
  const nums = () => Array.from({ length: 2 + ri(4) }, () => 1 + ri(40));
  const kvs = () => Array.from({ length: 2 + ri(3) }, (_, i) => `["k${i}",${1 + ri(40)}]`);
  const program = () => {
    const a = nums(), k = ri(14);
    if (k === 0) return `let it=[${a}].entries();it.next().value.join(",")`;
    if (k === 1) return `let it=[${a}].keys();it.next().value.toString()`;
    if (k === 2) return `let it=[${a}].values();it.next();it.next().value`;
    if (k === 3) return `let it=[${a}].entries();it.next();it.next().value.join(":")`;
    if (k === 4) return `[...[${a}].keys()].join(",")`;
    if (k === 5) return `[...[${a}].values()].join(",")`;
    if (k === 6) return `[...[${a}].entries()].map(e=>e.join(":")).join(",")`;
    if (k === 7) return `[...[${a}].map(x=>x*2)].join(",")`;
    if (k === 8) return `let m=new Map([${kvs()}]);m.keys().next().value`;
    if (k === 9) return `let m=new Map([${kvs()}]);let e=m.entries();e.next().value.join("=")`;
    if (k === 10) return `let m=new Map([${kvs()}]);[...m.values()].join(",")`;
    if (k === 11) return `let s=new Set([${a}]);s.values().next().value`;
    if (k === 12) return `let s=new Set([${a}]);[...s.entries()].map(e=>e.join(",")).join(";")`;
    return `let m=new Map([${kvs()}]);let r="";for(const [k,v] of m.entries())r+=k+v;r`;   // for-of regression
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String((0, eval)(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-iterprotocol: ${checked} iterator-protocol programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-iterprotocol: " + f); process.exit(1); }
