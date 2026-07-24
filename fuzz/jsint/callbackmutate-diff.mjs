// fuzz/jsint/callbackmutate — mutating ARRAY methods (pop/shift/push/splice) invoked INSIDE a callback
// body, especially as a nested argument (`out.push(s.pop())`) or an assignment RHS (`r.v=s.pop()`). The
// bug: execStmt's bare-array-mutation statement handlers (push/pop) fired for the OUTER `[…].forEach(…)`
// statement because the method marker (" . push (") also appears inside the callback body — so they
// evaluated a truncated receiver with side effects, double-running the mutation. Two guards fix it: skip
// the bare-mutation handler when the statement has a top-level ` = ` (it's an assignment RHS — the `=`
// handler owns it) or when the marker sits inside a nested function body (markerInBody — the call handler
// owns it). This exercises stack/queue idioms (RPN, BFS-drain) where pop/shift feed a push inside forEach/
// map, diffed vs Node.
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
  const cb = (body) => ri(2) ? `function(t){${body}}` : `t=>{${body}}`;
  const program = () => {
    const vals = Array.from({ length: 3 + ri(4) }, () => ri(20));
    const src = `[${vals.join(",")}]`;
    const k = ri(9);
    // out.push(s.pop()) inside forEach — the keystone (nested mutating arg)
    if (k === 0) return `(function(){let s=${src};let out=[];[0,0].forEach(${cb("out.push(s.pop())")});return JSON.stringify(out)+"/"+s.join(",")})()`;
    // out.push(s.shift()) inside forEach
    if (k === 1) return `(function(){let s=${src};let out=[];[0,0].forEach(${cb("out.push(s.shift())")});return JSON.stringify(out)+"/"+s.join(",")})()`;
    // assignment RHS inside forEach: r.v=s.pop()
    if (k === 2) return `(function(){let s=${src};let r={};[0].forEach(${cb("r.v=s.pop()")});return JSON.stringify(r.v)+"/"+s.join(",")})()`;
    // let v=s.pop(); out.push(v) — two statements, pop must run once
    if (k === 3) return `(function(){let s=${src};let out=[];[0,0].forEach(${cb("let v=s.pop();out.push(v)")});return out.join(",")+"/"+s.join(",")})()`;
    // map + s.pop() must mutate the captured array
    if (k === 4) return `(function(){let s=${src};[0,0].map(${cb("s.pop()")});return s.join(",")})()`;
    // RPN evaluator (the real-world workload)
    if (k === 5) { const seq = vals.slice(0, 3).join(" ") + " + " + vals[3 % vals.length] + " *"; return `(function(){function rpn(e){const s=[];e.split(" ").forEach(function(t){if(t==="+"){const b=s.pop();const a=s.pop();s.push(a+b)}else if(t==="*"){const b=s.pop();const a=s.pop();s.push(a*b)}else{s.push(Number(t))}});return s.pop()}return rpn(${JSON.stringify(seq)})})()`; }
    // nested forEach both pushing (grid build)
    if (k === 6) return `(function(){let g=[];[0,1].forEach(i=>{g.push([]);[0,1].forEach(j=>{g[i].push(i*10+j)})});return JSON.stringify(g)})()`;
    // splice inside a callback body
    if (k === 7) return `(function(){let a=${src};[0].forEach(${cb("a.splice(1,2)")});return a.join(",")})()`;
    // accumulate into one array, drain via shift in a second forEach
    return `(function(){let q=${src};let out=[];q.slice().forEach(${cb("out.push(q.shift())")});return out.join(",")+"/"+q.join(",")})()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-callbackmutate: ${checked} in-callback array-mutation programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-callbackmutate: " + f); process.exit(1); }
