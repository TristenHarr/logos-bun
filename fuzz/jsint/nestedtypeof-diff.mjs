// fuzz/jsint/nestedtypeof — `typeof` is right-nested: `typeof typeof 5` is `typeof (typeof 5)` =
// `typeof "number"` = `"string"`. resolveTypeof used to classify the FIRST occurrence, treating the
// inner `typeof` as a bare operand; it now resolves the INNERMOST (last) `typeof ` first so any depth
// collapses. Single/independent typeofs, typeof on unary/expr operands, and a property named `typeof`
// (must stay a member access, not the operator) are regression controls. Diffed vs Node. Operands are
// always literals/declared vars (undeclared-`typeof` is a separate known gap).
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "nt-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const operand = () => ["5", '"str"', "true", "undefined", "-3", "3.5", "{}", "[]", "(()=>1)", "1+2"][ri(10)];
  const program = () => {
    const o = operand(), k = ri(8);
    if (k === 0) return `console.log(typeof typeof ${o})`;              // depth 2 -> always "string"
    if (k === 1) return `console.log(typeof typeof typeof ${o})`;       // depth 3 -> "string"
    if (k === 2) return `console.log(typeof (${o}))`;                   // depth 1 control
    if (k === 3) return `console.log(typeof ${o} + "/" + typeof typeof ${o})`; // mixed depths
    if (k === 4) return `let v=${o}; console.log(typeof v, typeof typeof v)`;   // via a declared var
    if (k === 5) return `console.log(typeof typeof ${o} === "string")`;
    if (k === 6) return `let obj={typeof:7}; console.log(obj.typeof, typeof obj.typeof)`; // member, not operator
    return `console.log([${o}].map(x=>typeof typeof x).join(","))`;     // nested inside a callback
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
  if (!fails.length) console.log(`PASS jsint-nestedtypeof: ${checked} nested-typeof programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-nestedtypeof: " + f); process.exit(1); }
