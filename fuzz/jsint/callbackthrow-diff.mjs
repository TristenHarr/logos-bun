// fuzz/jsint/callbackthrow — a throw from inside a map/filter/forEach callback must propagate to the outer
// try/catch. callFnIdx/callFnIdx3 discarded the callback's __throw (unlike callFn), and the loops kept
// iterating, so the error vanished (caught e → NaN). callFnIdx/callFnIdx3 now propagate the throw and the
// loops short-circuit on a pending throw. This fuzzer runs map/filter/forEach with a callback that throws
// on a chosen element (directly or via a called function) and checks the caught message; the no-throw case
// checks the ordinary result is unchanged. (forEach scalar `s+=` writeback and chained `x.y.z` on an
// undefined intermediate are separate pre-existing gaps, not exercised here.)
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
  const methods = ["map", "filter", "forEach"];
  const program = () => {
    const len = 2 + ri(4);
    const arr = `[${Array.from({ length: len }, (_, i) => i + 1).join(",")}]`;
    const m = methods[ri(methods.length)];
    if (ri(2) === 0) {
      // throwing callback — trip on element === t (guaranteed in [1..len] so the throw always fires)
      const t = 1 + ri(len), tag = ri(999);
      const via = ri(2) === 0
        ? `x=>{ if(x===${t}) throw new Error("e${tag}"); return x }`
        : `x=>{ function boom(){ throw new Error("e${tag}") } if(x===${t}) boom(); return x }`;
      return `(function(){ try { ${arr}.${m}(${via}) } catch(e){ return e.message } })()`;
    }
    // non-throwing — ordinary result must be unchanged
    if (m === "map") return `(function(){ return ${arr}.map(x=>x*2).join(",") })()`;
    if (m === "filter") return `(function(){ return ${arr}.filter(x=>x%2===0).join(",") })()`;
    return `(function(){ let out=[]; ${arr}.forEach(x=>out.push(x+1)); return out.join(",") })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-callbackthrow: ${checked} callback-throw programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-callbackthrow: " + f); process.exit(1); }
