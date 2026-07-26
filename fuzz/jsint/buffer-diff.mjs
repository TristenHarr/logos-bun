// fuzz/jsint/buffer — Buffer encoding conversions: Buffer.from(str[, enc]) with utf8/base64/hex, and
// buf.toString([enc]) + buf.length. Buffer.from is textual/global (also `import { Buffer } from "buffer"`).
// ASCII inputs only (multi-byte UTF-8 byte-vs-char length, indexing, slice, alloc, concat are follow-ups).
// The driver precomputes base64/hex encodings (via Node's Buffer) to feed the decode cases. Exercised at
// top level and inside functions. Diffed vs Node.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function findBin(d, o = []) { let es; try { es = readdirSync(d); } catch { return o; } for (const e of es) { const p = join(d, e); let st; try { st = statSync(p); } catch { continue; } if (st.isDirectory()) findBin(p, o); else if (e === "bun" && st.mode & 0o111) o.push(p); } return o; }
const OURS = findBin(join(ROOT, "target")).filter((p) => !/vendor|oracle/.test(p)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const NODE = "node";
const fails = []; if (!OURS) fails.push("no logos-bun binary — build it");
function mul(s) { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const run = (bin, dir, args) => { const r = spawnSync(bin, args, { encoding: "utf8", cwd: dir, timeout: 5000 }); return ((r.stdout || "") + (r.status ? "\n<exit:" + r.status + ">" : "")).trim(); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const words = ["hello", "world", "abc", "logos", "x1y2", "The quick brown", "a=b&c=d", "12345", "", "buffer test"];
  const str = () => words[ri(words.length)];
  const program = () => {
    const s = str(), s2 = str(), k = ri(17);
    if (k === 14) { const codes = Array.from({ length: 1 + ri(5) }, () => 65 + ri(26)); return `console.log(Buffer.from([${codes.join(",")}]).toString(), Buffer.from([${codes.join(",")}]).length);`; }
    if (k === 15) return `const b = Buffer.from(${JSON.stringify(s || "z")});\nconsole.log(b[0], b[${ri(6)}], [10, 20, 30][1]);`;
    if (k === 16) return `const b = Buffer.from(${JSON.stringify(s || "abc")});\nlet t = 0;\nfor (let i = 0; i < b.length; i++) { t = t + b[i]; }\nconsole.log(t);`;
    if (k === 11) return `console.log(Buffer.from(${JSON.stringify(s)}).slice(0, ${ri(6)}).toString());`;
    if (k === 12) return `console.log(Buffer.byteLength(${JSON.stringify(s)}), Buffer.from(${JSON.stringify(s)}).slice(${ri(4)}).length);`;
    if (k === 13) return `console.log("str".slice(0, 2), [10, 20, 30].slice(1).join(","), Buffer.from(${JSON.stringify(s)}).slice(1, 3).toString());`;  // slice regression control
    if (k === 8) return `console.log(Buffer.alloc(${ri(6)}).toString("hex"), Buffer.alloc(${1 + ri(5)}).length);`;
    if (k === 9) return `console.log(Buffer.isBuffer(Buffer.from(${JSON.stringify(s)})), Buffer.isBuffer(${JSON.stringify(s)}), Buffer.isBuffer(${ri(9)}));`;
    if (k === 10) return `console.log(Buffer.concat([Buffer.from(${JSON.stringify(s)}), Buffer.from(${JSON.stringify(s2)})]).toString(), Buffer.concat([Buffer.from(${JSON.stringify(s)}), Buffer.from(${JSON.stringify(s2)})]).length);`;
    if (k === 0) return `console.log(Buffer.from(${JSON.stringify(s)}).toString());`;
    if (k === 1) return `console.log(Buffer.from(${JSON.stringify(s)}).length);`;
    if (k === 2) return `console.log(Buffer.from(${JSON.stringify(s)}).toString("hex"));`;
    if (k === 3) return `console.log(Buffer.from(${JSON.stringify(s)}).toString("base64"));`;
    if (k === 4) return `console.log(Buffer.from(${JSON.stringify(Buffer.from(s).toString("base64"))}, "base64").toString());`;
    if (k === 5) return `console.log(Buffer.from(${JSON.stringify(Buffer.from(s).toString("hex"))}, "hex").toString());`;
    if (k === 6) return `function rt(x) { return Buffer.from(Buffer.from(x).toString("base64"), "base64").toString(); }\nconsole.log(rt(${JSON.stringify(s)}));`;
    return `import { Buffer } from "buffer";\nconsole.log(Buffer.from(${JSON.stringify(s)}).toString("hex") + ":" + Buffer.from(${JSON.stringify(s)}).length);`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "buf-"));
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-buffer: ${checked} Buffer programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-buffer: " + f); process.exit(1); }
