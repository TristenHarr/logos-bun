// fuzz/jsint/consoleinspectwrap — console.log util.inspect MULTI-LINE wrapping + depth cutoff. A
// container whose single-line form exceeds Node's ~80-char breakLength wraps to one entry per line,
// indented by depth; nesting beyond depth 2 renders `[Object]`/`[Array]`/`[Set]`/`[Map]`. This exercises
// the full (possibly multi-line) output vs Node — the single/multi boundary (fitsSingleLine mirrors
// Node's isBelowBreakLength) and the depth-2 cutoff. Arrays/Sets/Maps are held to <=6 entries so Node's
// array column-grouping (>6 short elements packed into columns — NOT yet implemented) never triggers;
// objects have no grouping so any width is fair game. Diffed vs Node (`bun run`), full output compared.
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "ciw-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const keys = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "id", "name", "val"];
  const words = ["red", "green", "blue", "cat", "dog", "widget"];
  // a primitive literal
  const prim = () => { const t = ri(4); if (t === 0) return String(ri(1000)); if (t === 1) return JSON.stringify(words[ri(words.length)]); if (t === 2) return ri(2) ? "true" : "false"; return "null"; };
  // a value at nesting level L (L counts down); at L<=0 only primitives
  const value = (L) => {
    if (L <= 0 || ri(3) === 0) return prim();
    const t = ri(3);
    if (t === 0) { const m = 1 + ri(6); return "[" + Array.from({ length: m }, () => value(L - 1)).join(",") + "]"; } // array <=6
    // object
    const m = 1 + ri(5); const seen = new Set(); const parts = [];
    for (let i = 0; i < m; i++) { let k = keys[ri(keys.length)]; while (seen.has(k)) k = keys[ri(keys.length)]; seen.add(k); parts.push(`${k}:${value(L - 1)}`); }
    return "{" + parts.join(",") + "}";
  };
  const program = () => {
    const k = ri(8);
    if (k === 0) return `console.log(${value(1)})`;          // shallow, likely single-line
    if (k === 1) return `console.log(${value(2)})`;          // may wrap
    if (k === 2) return `console.log(${value(3)})`;          // deeper, may hit wrap + cutoff
    if (k === 3) return `console.log(${value(4)})`;          // deep, hits [Object]/[Array] cutoff
    if (k === 4) { const m = 1 + ri(6); return `console.log(new Set([${Array.from({ length: m }, () => prim()).join(",")}]))`; }
    if (k === 5) { const m = 1 + ri(5); const seen = new Set(); const ps = []; for (let i = 0; i < m; i++) { let key = words[ri(words.length)]; while (seen.has(key)) key = words[ri(words.length)]; seen.add(key); ps.push(`[${JSON.stringify(key)},${value(1)}]`); } return `console.log(new Map([${ps.join(",")}]))`; }
    if (k === 6) return `console.log({data:${value(2)},ok:true})`;
    return `console.log([${value(2)},${value(1)}])`;
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
  if (!fails.length) console.log(`PASS jsint-consoleinspectwrap: ${checked} inspect wrap/depth programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 12)) console.error("FAIL jsint-consoleinspectwrap: " + f); process.exit(1); }
