// fuzz/jsint/compoundassign — the compound assignment operators beyond += -= *= : **= /= %= <<= >>= &= |= ^=.
// The binary operators all existed but only +=/-=/*= (and the logical ||=/&&=/??=) had compound forms wired
// through the tokenizer + execStmt + member-target rewrite; the arithmetic/bitwise ones fell through to the
// plain ` = ` handler with a broken lhs. Added them to isOp2/isOp3 and both assignment paths. This fuzzer
// applies each compound operator to a simple variable, an object member, and an array index vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 300), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const ops = ["+=", "-=", "*=", "/=", "%=", "**=", "<<=", ">>=", "&=", "|=", "^="];
  const program = () => {
    const op = ops[ri(ops.length)];
    const a = 1 + ri(40), b = 1 + ri(6);
    const target = ri(3);
    if (target === 0) return `(function(){ let x=${a}; x ${op} ${b}; return x })()`;
    if (target === 1) return `(function(){ let o={n:${a}}; o.n ${op} ${b}; return o.n })()`;
    return `(function(){ let arr=[${a}, ${a + 1}]; arr[0] ${op} ${b}; return arr[0] })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-compoundassign: ${checked} compound-assignment programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-compoundassign: " + f); process.exit(1); }
