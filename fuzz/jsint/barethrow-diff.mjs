// fuzz/jsint/barethrow — a bare expression statement that throws, e.g. `null.x;` (property access on
// null/undefined). execStmt only evaluated a bare statement when it contained `(` (a call), so a bare
// member access fell through unevaluated and the TypeError never fired — the caught `e` degraded to NaN
// (while `return z.x`, `(null).x`, and `null[i]` worked). execStmt now also evaluates bare member (`.`)
// and index (`[`) statements, and the engine-thrown TypeError carries V8's exact message (encoded so its
// parens stay inert). This fuzzer throws via bare null/undefined member access and checks name, message,
// instanceof TypeError, and typeof of the caught error vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 200), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const props = ["x", "foo", "abc", "prop", "value", "name"];
  const bases = ["null", "undefined"];
  const probes = ["e.name", "e.message", "(e instanceof TypeError)", "typeof e", "e.constructor.name", "e.toString()", "e.message.length"];
  const program = () => {
    const base = bases[ri(bases.length)];
    const prop = props[ri(props.length)];
    const probe = probes[ri(probes.length)];
    // bare member-access statement inside try (via a temp var half the time)
    const body = ri(2) === 0 ? `${base}.${prop};` : `let z=${base}; z.${prop};`;
    return `(function(){ try { ${body} } catch(e){ return ${probe} } })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-barethrow: ${checked} bare-throw programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-barethrow: " + f); process.exit(1); }
