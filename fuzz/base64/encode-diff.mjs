// fuzz/base64/encode-diff — differential fuzzer for logos-bun's base64 encoder
// (base64Encode, RFC 4648) against Node's Buffer.from(s).toString('base64').
// Exercises the 3-byte→4-char bit-arithmetic (via //, %) and all three padding
// cases (0/1/2 `=`) written in pure LOGOS.
//
// SCOPE: printable-ASCII input (byte == codepoint == our ord), the realistic
// base64 domain (tokens, headers, text). Full binary bytes and UTF-8 multibyte
// input (where a LOGOS char is >1 byte, diverging from Buffer's UTF-8) are a
// later increment — the corpus stays ASCII so a diff is a real bug.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(dir, out = []) {
  let es; try { es = readdirSync(dir); } catch { return out; }
  for (const e of es) {
    const p = join(dir, e); let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) findBin(p, out);
    else if (e === "bun" && st.mode & 0o111) out.push(p);
  }
  return out;
}
const OURS = findBin(join(ROOT, "target"))
  .filter((p) => !/vendor|oracle/.test(p))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];

const fails = [];
if (!OURS) fails.push("no logos-bun binary under target/ — build it first");

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ours = (s) => {
  const r = spawnSync(OURS, ["__base64", s], { encoding: "utf8" });
  return r.status !== 0 ? `ERR:${r.status}` : (r.stdout || "").replace(/\n$/, "");
};
const oursDecode = (b) => {
  const r = spawnSync(OURS, ["__base64-decode", b], { encoding: "utf8" });
  return r.status !== 0 ? `ERR:${r.status}` : (r.stdout || "").replace(/\n$/, "");
};

if (OURS) {
  const seed = Number(process.argv[2] || 20260714);
  const n = Number(process.argv[3] || 1500);
  const rnd = mulberry32(seed);
  // Printable ASCII except space-adjacent argv hazards are fine; avoid the two
  // chars a shell-free spawnSync still can't carry cleanly (NUL) — codepoints
  // 33..126 plus space give full length-mod-3 coverage of the padding cases.
  const ch = () => String.fromCharCode(32 + Math.floor(rnd() * 95)); // 32..126
  const strings = ["", "a", "ab", "abc", "abcd", "Man", "Ma", "M", "sure.", "sure", "su", "leasure.", "easure.", "asure."];
  for (let i = 0; i < n; i++) {
    const len = Math.floor(rnd() * 40); // 0..39 covers every mod-3 remainder densely
    strings.push(Array.from({ length: len }, ch).join(""));
  }

  let checked = 0;
  for (const s of strings) {
    const ref = Buffer.from(s, "latin1").toString("base64"); // ASCII: byte == codepoint
    const got = ours(s);
    if (got !== ref) { fails.push(`base64(${JSON.stringify(s)}): ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`); checked++; continue; }
    // DECODE must round-trip the encode back to the original (and match Node's decode).
    if (s.length) {
      const back = oursDecode(got);
      const nodeBack = Buffer.from(got, "base64").toString("latin1");
      if (back !== s) fails.push(`decode(encode(${JSON.stringify(s)}))=${JSON.stringify(back)} ≠ original`);
      else if (back !== nodeBack) fails.push(`decode(${JSON.stringify(got)}): ours=${JSON.stringify(back)} node=${JSON.stringify(nodeBack)}`);
    }
    checked++;
  }
  if (!fails.length) console.log(`PASS base64: ${checked} strings — encode matches Node Buffer AND decode round-trips (seed ${seed})`);
}

if (fails.length) {
  for (const f of fails.slice(0, 20)) console.error("FAIL base64-encode: " + f);
  if (fails.length > 20) console.error(`… and ${fails.length - 20} more`);
  process.exit(1);
}
