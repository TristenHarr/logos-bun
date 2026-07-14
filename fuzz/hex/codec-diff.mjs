// fuzz/hex/codec-diff — differential fuzzer for logos-bun's hex codec (toHex /
// fromHex) against Node's Buffer.toString('hex') / Buffer.from(h,'hex'). Pure
// LOGOS byte↔nibble arithmetic; ASCII input (byte == codepoint == our ord).
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const run = (c, x) => { const r = spawnSync(OURS, [c, x], { encoding: "utf8" }); return r.status !== 0 ? `ERR` : (r.stdout || "").replace(/\n$/, ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 2000), rnd = mul(seed);
  const ch = () => String.fromCharCode(32 + Math.floor(rnd() * 95));
  let checked = 0;
  for (let i = 0; i < n; i++) {
    const s = Array.from({ length: Math.floor(rnd() * 40) }, ch).join("");
    const ref = Buffer.from(s, "latin1").toString("hex"), got = run("__hex", s);
    if (got !== ref) { fails.push(`hex(${JSON.stringify(s)}): ours=${got} node=${ref}`); checked++; continue; }
    if (s.length && run("__hex-decode", got) !== s) fails.push(`fromHex(toHex(${JSON.stringify(s)})) ≠ original`);
    checked++;
  }
  if (!fails.length) console.log(`PASS hex-codec: ${checked} strings — encode matches Node + decode round-trips (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 15)) console.error("FAIL hex-codec: " + f); process.exit(1); }
