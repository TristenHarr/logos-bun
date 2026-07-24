// fuzz/jsint/argumentsobj — the legacy `arguments` object inside a regular function. It was unbound
// (`typeof arguments` was "number", `arguments.length` garbage). Now callFn binds `arguments` to an array
// of the call's argument values — but ONLY when the body references `arguments`, so ordinary functions pay
// nothing and never re-evaluate their args (and since callFn receives already-evaluated args, even an
// arguments-using function doesn't double-run a side-effecting argument). Exercises arguments.length,
// arguments[i], the classic index loop (sum/max), spread `[...arguments]`, `Array.from(arguments)`, and
// mixing named params with arguments, plus plain (no-arguments) calls as regressions, diffed vs Node.
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
  const args = () => Array.from({ length: 1 + ri(5) }, () => ri(50));
  const program = () => {
    const a = args(), list = a.join(","), k = ri(7);
    if (k === 0) return `(function(){function f(){return arguments.length}return f(${list})})()`;
    if (k === 1) return `(function(){function f(){return arguments[${ri(a.length)}]}return f(${list})})()`;
    if (k === 2) return `(function(){function sum(){let t=0;for(let i=0;i<arguments.length;i++)t+=arguments[i];return t}return sum(${list})})()`;
    if (k === 3) return `(function(){function f(){return [...arguments].map(x=>x+1).join(",")}return f(${list})})()`;
    if (k === 4) return `(function(){function f(){return Array.from(arguments).length}return f(${list})})()`;
    if (k === 5) return `(function(){function f(first){return first+":"+arguments.length}return f(${list})})()`;
    // regression: plain function, no arguments
    return `(function(){function add(a,b){return a+b}return add(${a[0]},${a[1] ?? 0})})()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-argumentsobj: ${checked} arguments-object programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-argumentsobj: " + f); process.exit(1); }
