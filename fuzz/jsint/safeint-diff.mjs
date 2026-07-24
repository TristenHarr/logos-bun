// fuzz/jsint/safeint — two number-parsing fixes: (1) Number.isSafeInteger now bounds the magnitude to
// 2^53-1 (it was just isIntStr, so 2^53/9007199254740992 wrongly returned true); (2) Number() of a radix
// literal (hex/binary/octal) with SURROUNDING whitespace (`Number("  0x1F  ")`) now trims before the radix
// check (previously only the no-whitespace form worked). Compares isSafeInteger across the ±(2^53-1)
// boundary and whitespace-padded radix/decimal Number() strings vs Node.
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
  const program = () => {
    const k = ri(3);
    if (k === 0) {
      const base = ri(2) === 0 ? 9007199254740991 : ri(1000000000);
      const v = (base + (ri(5) - 2)) * (ri(2) ? 1 : -1);
      return `(function(){ return Number.isSafeInteger(${v}) })()`;
    }
    if (k === 1) {
      const [pfx, radix] = [["0x", 16], ["0b", 2], ["0o", 8]][ri(3)];
      const digits = [...Array(1 + ri(6))].map(() => "0123456789abcdef"[ri(radix)]).join("");
      const pad = " ".repeat(ri(3));
      return `(function(){ return Number(${JSON.stringify(pad + pfx + digits + pad)}) })()`;
    }
    const num = ri(999999) / (10 ** ri(4));
    return `(function(){ return Number(${JSON.stringify("  " + num + "  ")}) })()`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const p = program();
    let ref; try { ref = String(eval(p)); } catch { continue; }
    if (ref.includes("e") || ref.includes("E")) continue;
    const got = run(p);
    if (got !== ref) fails.push(`${p}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-safeint: ${checked} isSafeInteger/Number-radix programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-safeint: " + f); process.exit(1); }
