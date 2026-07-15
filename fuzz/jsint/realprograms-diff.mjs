// fuzz/jsint/realprograms-diff — INTEGRATION validation of the P7 engine. Not a
// fuzzer: a fixed battery of realistic, multi-feature JS programs (closures +
// higher-order + objects + arrays + strings + control flow together), each run
// through logos-bun AND Node and required to agree. This is the holistic proof
// that the ~36 features compose, not just work in isolation.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
const run = (p) => { const r = spawnSync(OURS, ["__js", p], { encoding: "utf8" }); return r.status !== 0 ? `ERR:${r.status}` : (r.stdout || "").replace(/\n$/, ""); };
const nodeRun = (p) => {
  let depth = 0, parts = [], cur = "";
  for (const c of p) {
    if (c === "{" || c === "(") depth++;
    else if (c === "}" || c === ")") depth--;
    if (c === ";" && depth === 0) { parts.push(cur); cur = ""; } else cur += c;
  }
  parts.push(cur);
  const body = parts.slice(0, -1).map((s) => s + ";").join("") + " return (" + parts[parts.length - 1] + ");";
  return eval("(()=>{" + body + "})()");
};
// NOTE on scoping: method CHAINING now works (leftmost-method dispatch) — these
// programs chain freely (`s.toUpperCase().indexOf(...)`, `a.filter(f).map(g).join(s)`).
// Two sugar gaps remain, documented in BUGS_FOUND.md: (a) a method call directly on
// an array LITERAL (`[1,2,3].filter(...)` — resolveMethods runs before the literal is
// a value; use a variable receiver), and (b) nested Math with a DIFFERENT inner fn
// (`Math.max(Math.abs(...))` — needs balanced-arg extraction). Both are avoided here.
const PROGRAMS = [
  // higher-order pipelines — real chains + arrows, on array-LITERAL and variable receivers
  `[1,2,3,4,5,6].filter(x=>x%2==0).map(x=>x*x).join("-")`,
  `"a,b,c,d".split(",").map(s=>s.toUpperCase()).join("|")`,
  `"one two three".split(" ").filter(w=>w.length>3).length`,
  `"5,3,8,1,9".split(",").map(s=>parseInt(s)).filter(n=>n>4).join(",")`,
  `const a=[1,2,3,4,5];a.reduce((s,x)=>s+x,0)`,
  `const nums=[3,7,2,8,5];nums.reduce((m,x)=>x>m?x:m,0)`,
  // closures
  `let adder=function(x){return function(y){return x+y}};adder(10)(32)`,
  `let mul=function(a){return function(b){return a*b}};let triple=mul(3);triple(7)+triple(2)`,
  `let f3=function(a){return function(b){return function(c){return a+b+c}}};f3(1)(2)(3)`,
  // recursion (both styles)
  `let fib=function(n){return n<2?n:fib(n-1)+fib(n-2)};fib(12)`,
  `let fact=function(n){if(n<=1){return 1};return n*fact(n-1)};fact(6)`,
  `let sum=function(n){return n==0?0:n+sum(n-1)};sum(50)`,
  // objects + nesting
  `let p={name:"bob",age:30};p.name+" is "+p.age`,
  `let data={users:[{n:"a",s:1},{n:"b",s:2}]};let u=data.users[1];u.n+u.s`,
  `let cfg={db:{host:"h",port:5432},retries:3};cfg.db.port+cfg.retries`,
  `let o={arr:[10,20,30]};o.arr[0]+o.arr[2]`,
  // array algorithms with control flow
  `let a=[3,7,2,8,1,9,4];let m=a[0];for(let i=1;i<a.length;i++){if(a[i]>m){m=a[i]}};m`,
  `let a=[5,1,4,2,8];let s=0;for(let i=0;i<a.length;i++){s+=a[i]};s`,
  `let a=[1,2,3,4,5];let c=0;for(let i=0;i<a.length;i++){if(a[i]%2==1){c++}};c`,
  `let words=["the","quick","brown","fox"];let total=0;for(const w of words){total+=w.length};total`,
  `let evens=[];for(let i=1;i<=10;i++){if(i%2==0){evens.push(i)}};evens.join(",")`,
  `let scores={alice:90,bob:75,carol:88};Object.values(scores).reduce((s,x)=>s+x,0)`,
  "let user={name:\"ada\",age:36};`${user.name} is ${user.age}`",
  `let cfg={port:8080,tls:true,hosts:["a","b"]};JSON.stringify(cfg)`,
  `let nums=[1,2,3,4,5];let doubled=nums.map(x=>x*2);JSON.stringify(doubled)`,
  `let cfg=JSON.parse("{\\"port\\":8080,\\"names\\":[\\"a\\",\\"b\\"]}");cfg.port+cfg.names.length`,
  `let o={a:1,b:{c:[2,3]}};let clone=JSON.parse(JSON.stringify(o));clone.b.c[1]`,
  `let o={a:1,b:2,c:3};let ks="";for(const k of Object.keys(o)){ks+=k};ks`,
  `let parts=[];for(let n of [5,42,7]){parts.push((""+n).padStart(3,"0"))};parts.join(":")`,
  // strings — real method chains
  `"Hello World".toUpperCase().indexOf("WORLD")`,
  `"  padded  ".trim().length`,
  `"abcabc".replace("b","X").indexOf("X")`,
  `"jane doe".split(" ").map(function(w){return w.charAt(0).toUpperCase()}).join("")`,
  // mixed
  `let inv={apple:3,banana:5};let total=inv.apple+inv.banana;total>7?"lots":"few"`,
  `let nums="10,20,30".split(",");let t=0;for(let i=0;i<nums.length;i++){t+=parseInt(nums[i])};t`,
  `let grid=[[1,2],[3,4]];grid[0][0]+grid[0][1]+grid[1][0]+grid[1][1]`,
  `Math.max(Math.abs(-8),Math.min(3,10))`,
  `let head=[1,2];let tail=[4,5];[...head,3,...tail].reduce((s,x)=>s+x,0)`,
  `let r="?";switch(2){case 1:r="a";break;case 2:r="b";break;default:r="z"};r`,
];
if (OURS) {
  let checked = 0;
  for (const p of PROGRAMS) {
    let ref; try { ref = nodeRun(p); } catch (e) { fails.push(`REF-THREW ${JSON.stringify(p)}: ${e.message}`); continue; }
    ref = String(ref);
    const got = run(p);
    if (got !== ref) fails.push(`jsExec(${JSON.stringify(p)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-realprograms: ${checked} real multi-feature programs agree with Node`);
}
if (fails.length) { for (const f of fails.slice(0, 30)) console.error("FAIL jsint-realprograms: " + f); process.exit(1); }
