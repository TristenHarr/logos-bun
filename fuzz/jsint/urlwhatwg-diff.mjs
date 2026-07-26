// fuzz/jsint/urlwhatwg — the WHATWG `new URL(absoluteUrl)` constructor. The parser splits off fragment
// then query, lowercases the scheme, and (for a `//` authority) separates userinfo@host and hostname:port
// with the default port dropped; the result exposes href/protocol/username/password/host/hostname/port/
// pathname/search/hash/origin as properties. Absolute special-scheme URLs (http/https/ws/ftp) are covered;
// relative resolution, URLSearchParams, IPv6, and percent-encoding normalization are deferred. Each field
// is compared to Node. Runs at top level AND inside a function (regression control for the multi-line
// splitTop fix, since `new URL` in a function body was the original trigger). Diffed vs Node.
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
  const scheme = () => ["http", "https", "ws", "ftp"][ri(4)];
  const host = () => ["example.com", "a.b.c", "sub.domain.io", "host", "my-site.org"][ri(5)];
  const port = () => [":8080", ":3000", ":443", ":80", "", ":9999"][ri(6)];
  const path = () => ["/", "/a/b", "/p/q/r", "/x.js", "/api/v1/", ""][ri(6)];
  const q = () => ["?x=1&y=2", "?only=query", "", "?a=b"][ri(4)];
  const frag = () => ["#frag", "#", "", "#section-2"][ri(4)];
  const auth = () => ["", "user@", "user:pass@"][ri(3)];
  const mkUrl = () => `${scheme()}://${auth()}${host()}${port()}${path()}${q()}${frag()}`;
  const fields = `[u.href,u.protocol,u.username,u.password,u.host,u.hostname,u.port,u.pathname,u.search,u.hash,u.origin].join(" | ")`;
  const program = () => {
    const url = mkUrl(), k = ri(4);
    if (k === 0) return `const u = new URL(${JSON.stringify(url)});\nconsole.log(${fields});`;
    if (k === 1) return `function show(s) {\n  const u = new URL(s);\n  console.log(${fields});\n}\nshow(${JSON.stringify(url)});`;
    if (k === 2) return `const u = new URL(${JSON.stringify(url)});\nconsole.log(u.protocol, u.hostname, u.pathname);`;
    return `function get(s) {\n  return new URL(s).host;\n}\nconsole.log(get(${JSON.stringify(url)}));`;
  };
  let checked = 0;
  for (let it = 0; it < n; it++) {
    const dir = mkdtempSync(join(tmpdir(), "urf-"));
    const src = program();
    writeFileSync(join(dir, "e.js"), src);
    writeFileSync(join(dir, "e.mjs"), src);
    const ref = run(NODE, dir, ["e.mjs"]);
    const got = run(OURS, dir, ["run", "e.js"]);
    if (got !== ref) fails.push(`${JSON.stringify(src)}: ours=${JSON.stringify(got)} node=${JSON.stringify(ref)}`);
    rmSync(dir, { recursive: true, force: true });
    checked++;
  }
  if (!fails.length) console.log(`PASS jsint-urlwhatwg: ${checked} new URL programs agree with Node (seed ${seed})`);
}
if (fails.length) { for (const f of fails.slice(0, 20)) console.error("FAIL jsint-urlwhatwg: " + f); process.exit(1); }
