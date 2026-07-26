// fuzz/jsint/consoleinspect — console.log of arrays / plain objects uses Node's util.inspect form
// (`[ 1, 2, 3 ]`, `{ a: 1, b: 2 }`, nested `{ a: [ { b: 2 } ] }`, empty `[]`/`{}`), NOT the join /
// `[object Object]` that materialize produces for String()/template/`+`. Top-level strings print raw;
// nested strings are single-quoted; non-identifier keys are single-quoted and integer keys sort first.
// bigDisplay (the console-only render seam) now routes through a recursive inspectVal. Programs are kept
// small so their single-line output stays under Node's ~80-char breakLength (multi-line wrapping + array
// column-grouping for large structures are a documented follow-up and are NOT exercised here). Regression
// controls: .join / String() / template still use the comma form. Diffed vs Node (`bun run`).
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "ci-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const words = ["hi", "ok", "Bob", "xy", "red", "cat"];
  const idents = ["a", "b", "c", "n", "x", "id", "name", "val"];
  const smallArr = () => "[" + Array.from({ length: 1 + ri(4) }, () => ri(20)).join(",") + "]";
  const strArr = () => "[" + Array.from({ length: 1 + ri(3) }, () => JSON.stringify(words[ri(words.length)])).join(",") + "]";
  const prim = () => { const t = ri(4); if (t === 0) return String(ri(50)); if (t === 1) return JSON.stringify(words[ri(words.length)]); if (t === 2) return ri(2) ? "true" : "false"; return "null"; };
  const smallObj = () => { const m = 1 + ri(3); const seen = new Set(); const parts = []; for (let i = 0; i < m; i++) { let k = idents[ri(idents.length)]; while (seen.has(k)) k = idents[ri(idents.length)]; seen.add(k); parts.push(`${k}:${prim()}`); } return "{" + parts.join(",") + "}"; };
  const program = () => {
    const k = ri(14);
    if (k === 0) return `console.log(${smallArr()})`;
    if (k === 1) return `console.log(${strArr()})`;
    if (k === 2) return `console.log(${smallObj()})`;
    if (k === 3) return `console.log([])`;
    if (k === 4) return `console.log({})`;
    if (k === 5) return `console.log({${idents[ri(idents.length)]}:${smallArr()}})`;
    if (k === 6) return `console.log([${smallObj()},${smallObj()}])`;
    if (k === 7) return `console.log({${idents[ri(idents.length)]}:${smallObj()}})`;
    if (k === 8) return `console.log(${smallArr()}.map(x=>x+1))`;
    if (k === 9) return `console.log(${smallArr()}.filter(x=>x<10))`;
    if (k === 10) return `console.log({"a-b":${ri(9)},ok:${ri(9)}})`;
    if (k === 11) return `console.log(${prim()},${smallArr()})`;
    // regression controls: comma form via join / String() / template — NOT inspect
    if (k === 12) return `const a=${smallArr()};console.log(a.join(","),String(a),\`\${a}\`)`;
    return `console.log(${prim()})`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    const ref = runFile("node", p);
    if (ref.includes("\n")) continue;  // Node wrapped it multi-line (>~80 chars) — Stage 2, out of scope here
    const got = runFile(OURS, p);
    if (got !== ref) fails.push(`run(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  rmSync(dir, { recursive: true, force: true });
  if (!fails.length) console.log(`PASS jsint-consoleinspect: ${checked} console.log inspect programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-consoleinspect: " + f); process.exit(1); }
