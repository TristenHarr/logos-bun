// fuzz/jsint/jsonreplacer — JSON.stringify's 2nd argument (an array allowlist of keys, or a function
// that transforms each value top-down) and JSON.parse's 2nd argument (a reviver run bottom-up). Both
// were ignored (stringify dropped the replacer; parse fed the whole arg list to eval → SyntaxError).
// Now the stringify replacer walks the value tree (jsonReplace / jsonAllowVal) and the parse reviver
// walks the parsed tree (jsonRevive), each applying the callback and honoring an undefined return
// (a dropped property). Plain (one-arg) stringify/parse must be unchanged. Diffed vs Node.
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "jr-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 100), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = ri(50), b = ri(50), c = ri(50), k = ri(8);
    if (k === 0) return `console.log(JSON.stringify({a:${a},b:${b},c:${c}},["a","c"]))`;
    if (k === 1) return `console.log(JSON.stringify({a:${a},b:{a:${b},c:${c}}},["a"]))`;
    if (k === 2) return `console.log(JSON.stringify({a:${a},b:${b}},(k,v)=>typeof v==="number"?v*2:v))`;
    if (k === 3) return `console.log(JSON.stringify({x:${a},y:${b},z:${c}},(k,v)=>k==="y"?undefined:v))`;
    if (k === 4) return `console.log(JSON.parse('{"a":${a},"b":${b}}',(k,v)=>typeof v==="number"?v+10:v).a)`;
    if (k === 5) return `console.log(JSON.parse('[${a},${b},${c}]',(k,v)=>typeof v==="number"?v*3:v).join(","))`;
    if (k === 6) return `console.log(JSON.stringify({a:${a},b:[${b},${c}]}))`;                 // regression: plain
    return `console.log(JSON.parse('{"n":{"x":${a}}}').n.x)`;                                    // regression: plain
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
  if (!fails.length) console.log(`PASS jsint-jsonreplacer: ${checked} JSON replacer/reviver programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-jsonreplacer: " + f); process.exit(1); }
