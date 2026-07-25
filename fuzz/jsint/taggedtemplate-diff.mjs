// fuzz/jsint/taggedtemplate — tagged templates tag`a${x}b` → tag(["a","b"], x) and String.raw. A
// pre-pass (desugarTaggedTemplates, before desugarTemplates) detects a backtick preceded by a non-keyword
// identifier/member, splits the template into cooked quasis + interpolated expressions, and rewrites to a
// call `tag([ "a" , "b" ] , ( x ))`; String.raw`…` becomes a concat of RAW quasis (backslashes doubled) +
// values. Exercises the strings array (index/length/join/reduce), multiple interpolations, and raw
// backslashes; untagged templates are regressions and must be untouched. Diffed vs Node.
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
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 250), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const program = () => {
    const a = ri(20), b = ri(20), c = ri(20), k = ri(9);
    if (k === 0) return `let t=(s,...v)=>s.join("|")+"/"+v.join(",");t\`a\${${a}}b\${${b}}c\``;
    if (k === 1) return `let t=(s,...v)=>s.length+","+v.length;t\`x\${${a}}y\${${b}}z\``;
    if (k === 2) return `let t=(s,...v)=>s.reduce((acc,str,i)=>acc+str+(v[i]||""),"");t\`\${${a}}+\${${b}}=\${${c}}\``;
    if (k === 3) return `function tag(s){return s[0]+s[1]}tag\`p\${${a}}q\``;
    if (k === 4) return `let f=(s,...v)=>v.reduce((x,y)=>x+y,0);f\`\${${a}}m\${${b}}n\${${c}}\``;
    if (k === 5) return `String.raw\`a\\nb\${${a}}c\``;
    if (k === 6) return `String.raw\`x\${${a}}y\``;
    if (k === 7) return `let x=${a};\`val=\${x}\``;                       // regression: untagged
    return `\`\${${a}} and \${${b}}\``;                                   // regression: untagged multi
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String((0, eval)(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-taggedtemplate: ${checked} tagged-template programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-taggedtemplate: " + f); process.exit(1); }
