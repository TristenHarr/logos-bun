// fuzz/jsint/errorcause — the 2-arg Error constructor `new Error(message, { cause })` (ES2022) across the
// Error subclasses. buildErrorCall used to jsEvalIn the WHOLE arg string, so `"x", {cause:…}` evaluated as
// a comma-expression and the options object landed in e.message; now only the first arg is the message and
// a `cause` from the options object is attached (e.cause). Plain 1-arg / no-arg forms are regression
// controls. Diffed vs Node (`bun run`).
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "ec-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const kinds = ["Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError"];
  const msgs = ["boom", "bad input", "not found", "oops"];
  const program = () => {
    const E = kinds[ri(kinds.length)];
    const m = JSON.stringify(msgs[ri(msgs.length)]);
    const k = ri(6);
    if (k === 0) return `try{throw new ${E}(${m},{cause:${JSON.stringify(msgs[ri(msgs.length)])}})}catch(e){console.log(e.name+"|"+e.message+"|"+e.cause)}`;
    if (k === 1) return `try{throw new ${E}(${m},{cause:${ri(100)}})}catch(e){console.log(e.message,e.cause)}`;
    if (k === 2) return `try{throw new ${E}(${m})}catch(e){console.log(e.name+": "+e.message+" cause="+e.cause)}`;  // 1-arg control
    if (k === 3) return `try{throw new ${E}()}catch(e){console.log(JSON.stringify(e.message)+" "+e.name)}`;         // no-arg control
    if (k === 4) return `function f(){try{JSON.parse("{")}catch(err){throw new ${E}(${m},{cause:err})}}try{f()}catch(e){console.log(e.message+"|"+e.cause.name)}`;  // chaining
    return `const e=new ${E}(${m},{cause:${m}});console.log(e.cause===${m},e.message===${m})`;
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
  if (!fails.length) console.log(`PASS jsint-errorcause: ${checked} Error(msg,{cause}) programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-errorcause: " + f); process.exit(1); }
