// fuzz/jsint/instanceof — instanceof for the built-in constructors (Array/Object/Error hierarchy), which
// carry no class-ancestry tag so resolveInstanceof previously said false for all of them: `[1,2] instanceof
// Array`, `{} instanceof Object`, `new TypeError() instanceof Error/TypeError` were wrongly false. Added
// errInstanceMatch (now builtin-instance): an array is Array + Object; any object/instance is Object; an
// Error object is Error and the constructor named by its own `name`. User-class instanceof (the ancestry
// chain) is unchanged. This fuzzer checks each value type against each constructor vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 400), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const values = ["[1,2,3]", "({a:1})", "(new Error('m'))", "(new TypeError('m'))", "(new RangeError('m'))", "(new SyntaxError('m'))", "(new Map())", "(new Set())"];
  const ctors = ["Array", "Object", "Error", "TypeError", "RangeError", "SyntaxError"];
  const program = () => {
    const v = values[ri(values.length)], c = ctors[ri(ctors.length)];
    return `(function(){ return ${v} instanceof ${c} })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-instanceof: ${checked} instanceof programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-instanceof: " + f); process.exit(1); }
