// fuzz/jsint/optchainsc — optional chaining short-circuit consumes the WHOLE remaining chain. When a `?.`
// receiver is nullish, `o?.x?.y?.z` (3+ levels), or a chain from a null/undefined receiver, must yield
// undefined — the old code skipped only one access, leaving the tail to evaluate on undefined and read NaN.
// optChainSkip now walks every following `?.`/`.` member and `[…]`/`(…)`, stopping at the first non-chain
// token (so `null?.x.y + 5` is `undefined + 5` = NaN). Chains that fully resolve, optional index/call, and
// nullish-coalesce defaults are regression controls. Diffed vs Node.
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "os-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const a = () => 1 + ri(9);
  const program = () => {
    const k = ri(12);
    if (k === 0) return `const o={a:${a()}}; console.log(o?.x?.y?.z)`;
    if (k === 1) return `const o=null; console.log(o?.a?.b?.c)`;
    if (k === 2) return `const o=undefined; console.log(o?.a?.b)`;
    if (k === 3) return `const o={a:${a()}}; console.log(o?.x?.y?.z?.w?.v)`;                 // 5-level
    if (k === 4) return `const o={a:${a()}}; console.log(typeof (o?.x?.y?.z))`;
    if (k === 5) return `const o={a:${a()}}; console.log(o?.x?.y?.z === undefined)`;
    if (k === 6) return `const o={a:${a()}}; console.log(o?.x?.y + ${a()})`;                 // -> NaN
    if (k === 7) return `const o={a:${a()}}; console.log(o?.x?.[0]?.y)`;                      // mixed index
    // regression controls — chains that resolve
    if (k === 8) return `const o={a:{b:{c:${a()}}}}; console.log(o?.a?.b?.c)`;
    if (k === 9) return `const o={a:{b:${a()}}}; console.log(o?.a?.b)`;
    if (k === 10) return `const arr=[${a()},${a()}]; console.log(arr?.[1])`;
    return `const o={a:${a()}}; console.log(o?.a ?? "d", o?.x ?? "d")`;                       // nullish coalesce
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
  if (!fails.length) console.log(`PASS jsint-optchainsc: ${checked} optional-chain programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-optchainsc: " + f); process.exit(1); }
