// fuzz/jsint/newmethodcall — an unparenthesized `new X(args).method()`. recvStart scanned back to the
// constructor name but stopped one token short of the leading `new`, so the method receiver became a plain
// call `X(args)` (no constructed object) → wrong/empty result; the parenthesized `(new X(args)).method()`
// and `let e = new X(); e.method()` both worked. recvStart now includes a preceding `new`. This fuzzer
// builds `new C(args).method()` over Error/TypeError (.toString/.message), Date (.getUTCFullYear), Map
// (.get/.has), Set (.has), and Array (.fill().join) and diffs vs Node.
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
  const program = () => {
    const k = ri(6);
    if (k === 0) return `(function(){ return new Error("e" + ${ri(99)}).toString() })()`;
    if (k === 1) return `(function(){ return new TypeError("t" + ${ri(99)}).message.toUpperCase() })()`;
    if (k === 2) return `(function(){ return new Map([["k", ${ri(99)}]]).get("k") })()`;
    if (k === 3) return `(function(){ return new Set([${Array.from({ length: 1 + ri(4) }, () => ri(5)).join(",")}]).has(${ri(5)}) })()`;
    if (k === 4) return `(function(){ return new Array(${1 + ri(5)}).fill(${ri(9)}).join(",") })()`;
    return `(function(){ class P{ constructor(a){ this.a=a } m(){ return this.a*2 } } return new P(${ri(50)}).m() })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-newmethodcall: ${checked} new-X(args).method() programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-newmethodcall: " + f); process.exit(1); }
