// fuzz/jsint/nestedtemplate — nested template literals (a template inside another template's ${…}),
// incl. the ubiquitous `<ul>${items.map(i=>`<li>${i}</li>`).join("")}</ul>` HTML-building pattern, and
// templates containing `/` (`</div>`, `/api/${x}`). Two fixes: (1) desugarTemplatesN now handles a nested
// backtick in interpolation via a template-nesting depth stack; (2) template desugar runs BEFORE regex-
// literal desugar in normalizeJs, so `/` in template TEXT no longer mis-fires as a spurious regex. Regex
// literals, regex-in-interpolation, and division are regression controls. Diffed vs Node (`bun run`).
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
const dir = OURS ? mkdtempSync(join(tmpdir(), "nt-")) : null;
const runFile = (bin, p) => { const f = join(dir, "p.mjs"); writeFileSync(f, p); const r = spawnSync(bin, bin === OURS ? ["run", f] : [f], { encoding: "utf8", timeout: 5000 }); return (r.stdout || "").replace(/\n$/, "") + ((r.stderr && r.status !== 0) ? "|ERR" : ""); };
if (OURS) {
  const seed = Number(process.argv[2] || 1), n = Number(process.argv[3] || 90), rnd = mul(seed);
  const ri = (k) => Math.floor(rnd() * k);
  const words = ["a", "b", "x", "cat", "id"];
  const w = () => words[ri(words.length)];
  const program = () => {
    const k = ri(12);
    if (k === 0) return `const x=${JSON.stringify(w())};console.log(\`outer \${\`inner \${x}\`}\`)`;
    if (k === 1) return `console.log(\`<ul>\${[${JSON.stringify(w())},${JSON.stringify(w())}].map(i=>\`<li>\${i}</li>\`).join("")}</ul>\`)`;
    if (k === 2) return `const n=${ri(10)};console.log(\`\${n>3?\`big\${n}\`:"small"}\`)`;
    if (k === 3) return `const x=${JSON.stringify(w())};console.log(\`a\${\`b\${\`c\${x}\`}\`}\`)`;
    if (k === 4) return `const p=${JSON.stringify(w())};console.log(\`/api/\${p}/list\`)`;
    if (k === 5) return `console.log(\`</div>\`)`;
    if (k === 6) return `const items=[${JSON.stringify(w())},${JSON.stringify(w())}];console.log(items.map(i=>\`[\${i}]\`).join(","))`;
    if (k === 7) return `const o={n:${ri(9)}};console.log(\`n=\${o.n}\`)`;                             // simple control
    if (k === 8) return `console.log(/\\d+/.test(${JSON.stringify(w() + ri(9))}))`;                    // regex control
    if (k === 9) return `console.log("a1b2".replace(/\\d/g,"_"))`;                                     // regex control
    if (k === 10) return `const s=${JSON.stringify(w() + "1")};console.log(\`d=\${/\\d/.test(s)}\`)`;   // regex in interp
    return `const a=${1 + ri(9)},b=${1 + ri(3)};console.log(\`\${a}/\${b} = \${Math.floor(a/b)}\`)`;    // slash text + division
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
  if (!fails.length) console.log(`PASS jsint-nestedtemplate: ${checked} nested-template programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-nestedtemplate: " + f); process.exit(1); }
