// fuzz/jsint/datejson — JSON.stringify of a Date renders its ISO-8601 string (toJSON), at the top
// level and NESTED inside objects/arrays, plain and pretty-printed. Previously a nested Date serialized
// as its internal {"__date_ms":n} object because the ISO path only ran on the top-level argument;
// jsonStringify / jsonStrInd now special-case a Date ref before the generic object branch. Diffed vs
// Node by running a module file through both `bun run` and `node`.
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "djson-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8" }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 120), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const ms = ri(2000000000000), k = ri(6);
    if (k === 0) return `console.log(JSON.stringify(new Date(${ms})))`;
    if (k === 1) return `console.log(JSON.stringify({d:new Date(${ms}),n:${ri(99)}}))`;
    if (k === 2) return `console.log(JSON.stringify([new Date(${ms}),new Date(0)]))`;
    if (k === 3) return `console.log(JSON.stringify({when:new Date(${ms})},null,2))`;
    if (k === 4) return `console.log(new Date(${ms}).toISOString())`;                 // direct ISO
    return `console.log(JSON.stringify({a:{b:new Date(${ms})}}))`;                     // deep nest
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
  if (!fails.length) console.log(`PASS jsint-datejson: ${checked} Date-JSON programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-datejson: " + f); process.exit(1); }
