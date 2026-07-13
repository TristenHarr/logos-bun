#!/usr/bin/env node
// commit.mjs — THE canonical committer (CLAUDE.md R4, BAKE_A_BUN §2.5 "Workflow ops").
// The dynamic-workflow RUNNER is a script, never an interactive agent typing git. It ONLY
// ever does `git add <named paths> && git commit <named paths> -m <msg>` — never `-a`,
// never `add .`, never any destructive/wholesale verb. Refusals are machine-checkable:
//
//   exit 3 = manifest violation   (a named path is outside the card's `## Manifest`)
//   exit 4 = vendor               (a named path is under vendor/ — always pristine, R5)
//   exit 5 = RED-first (L10)       (an impl path while the card's red/** paths are uncommitted)
//   exit 6 = gate red             (`scripts/gate.sh --quick` failed)
//   exit 2 = usage / bad arguments
//   exit 1 = git/internal error
//
// Usage: commit.mjs --card <id> --paths <p1,p2,...> -m <msg> [--root <dir>]
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const EXIT = { USAGE: 2, MANIFEST: 3, VENDOR: 4, RED_FIRST: 5, GATE: 6, INTERNAL: 1 };

function die(code, msg) {
  console.error("commit.mjs REFUSE: " + msg + "  (see CLAUDE.md R4 / §2.5)");
  process.exit(code);
}

// ── argv ────────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = { card: null, paths: null, msg: null, root: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--card") a.card = argv[++i];
    else if (k === "--paths") a.paths = argv[++i];
    else if (k === "-m" || k === "--message") a.msg = argv[++i];
    else if (k === "--root") a.root = argv[++i];
    else die(EXIT.USAGE, `unknown argument ${JSON.stringify(k)}`);
  }
  return a;
}

// ── card + manifest ──────────────────────────────────────────────────────────────
// Cards live at work/cards/<id>*.md. The `## Manifest` section is a comma-separated list
// of path globs (possibly multi-line), each optionally trailed by a parenthetical note
// like `(append)` / `(L8)` / `(gate log)`. RED paths are the `red/**` entries.
function findCard(root, id) {
  const cards = join(root, "work", "cards");
  if (!existsSync(cards)) die(EXIT.INTERNAL, `no work/cards under ${root}`);
  // Exact-prefix match on the card id, up to a `-` or `.md` boundary, so `WX.1` never
  // matches `WX.10` (card-id spoof guard).
  const hits = readdirSync(cards).filter((f) => {
    if (!f.endsWith(".md")) return false;
    if (f === `${id}.md`) return true;
    return f.startsWith(`${id}-`);
  });
  if (hits.length === 0) die(EXIT.INTERNAL, `no card matches id ${JSON.stringify(id)} in work/cards`);
  if (hits.length > 1) die(EXIT.INTERNAL, `card id ${JSON.stringify(id)} is ambiguous: ${hits.join(", ")}`);
  return join(cards, hits[0]);
}

function parseManifest(cardText) {
  // Grab the `## Manifest` section body up to the next `## ` heading or EOF.
  const m = cardText.match(/^##\s+Manifest\s*\n([\s\S]*?)(?=\n##\s|$)/m);
  if (!m) die(EXIT.INTERNAL, "card has no `## Manifest` section");
  const body = m[1];
  const globs = [];
  for (let piece of body.split(",")) {
    // Drop parenthetical notes and surrounding whitespace/newlines.
    piece = piece.replace(/\([^)]*\)/g, " ").trim();
    if (!piece) continue;
    // A manifest entry may itself span a line break inside the split; collapse whitespace.
    piece = piece.replace(/\s+/g, "");
    if (piece) globs.push(piece);
  }
  if (globs.length === 0) die(EXIT.INTERNAL, "card `## Manifest` section is empty");
  return globs;
}

// Compile a manifest glob into a matcher. Supported: `**` (any depth incl. zero segments),
// `*` (within a segment), literal path prefix (`gate.sh` matches exactly, `scripts/x/**`
// matches everything under it). Matching is done on normalized forward-slash relatives.
function globToRegExp(glob) {
  const g = glob.replace(/\\/g, "/").replace(/\/+$/, "");
  let re = "^";
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*") {
      if (g[i + 1] === "*") {
        // `**` — any number of path segments (and possibly a trailing `/`).
        i++;
        if (g[i + 1] === "/") i++;
        re += "(?:.*/)?.*";
      } else {
        re += "[^/]*"; // single-segment wildcard
      }
    } else if ("\\^$.|?+()[]{}".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  re += "$";
  return new RegExp(re);
}

function pathAllowed(rel, matchers) {
  return matchers.some((m) => m.test(rel));
}

// ── path normalization + traversal guard ──────────────────────────────────────────
// Every named path is resolved against root and re-relativized. A path that escapes root
// (via `..`, an absolute path, or a symlink) is rejected as an out-of-manifest violation —
// the manifest can only ever grant IN-tree globs, so escaping it is definitionally outside.
function relativize(root, p) {
  const abs = resolve(root, p);
  const rootAbs = resolve(root);
  if (abs !== rootAbs && !abs.startsWith(rootAbs + sep)) return null; // escaped the tree
  let rel = abs.slice(rootAbs.length).replace(/^[/\\]/, "").replace(/\\/g, "/");
  return rel;
}

// ── git (named-paths only, never -a / add . / wholesale) ──────────────────────────
function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: "pipe" });
}
function gitCode(root, args) {
  try { git(root, args); return 0; }
  catch (e) { return typeof e.status === "number" ? e.status : 1; }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(args.root || join(dirname(fileURLToPath(import.meta.url)), "..", ".."));
  if (!args.card) die(EXIT.USAGE, "missing --card <id>");
  if (args.msg == null || args.msg === "") die(EXIT.USAGE, "missing -m <msg>");
  if (args.paths == null) die(EXIT.USAGE, "missing --paths <p1,p2,...>");

  const paths = args.paths.split(",").map((s) => s.trim()).filter(Boolean);
  if (paths.length === 0) die(EXIT.USAGE, "empty path list (the runner never commits nothing)");

  const cardPath = findCard(root, args.card);
  const manifestGlobs = parseManifest(readFileSync(cardPath, "utf8"));
  const matchers = manifestGlobs.map(globToRegExp);
  const redGlobs = manifestGlobs.filter((g) => g.replace(/\\/g, "/").startsWith("red/"));

  // Normalize + guard every path, THEN classify (vendor > manifest ordering matters:
  // vendor is refused even if a malformed manifest tried to grant it).
  const rels = [];
  for (const p of paths) {
    const rel = relativize(root, p);
    if (rel === null) die(EXIT.MANIFEST, `path escapes the repo root: ${JSON.stringify(p)}`);
    rels.push(rel);
  }
  for (const rel of rels) {
    if (rel === "vendor" || rel.startsWith("vendor/")) die(EXIT.VENDOR, `path under vendor/ is pristine reality: ${rel}`);
  }
  for (const rel of rels) {
    if (!pathAllowed(rel, matchers)) die(EXIT.MANIFEST, `path outside card ${args.card} manifest: ${rel}`);
  }

  // L10 — TDD at commit time. If ANY named path is an implementation path (not itself a
  // red/** path), the card's RED paths must already have committed history. "Committed
  // history" = `git log --oneline -1 -- <red-path>` non-empty for at least one red glob's
  // tracked file. We resolve red globs to actually-tracked files via `git ls-files`.
  const committingImpl = rels.some((rel) => !redGlobs.some((g) => globToRegExp(g).test(rel)));
  if (committingImpl && redGlobs.length > 0) {
    let redHasHistory = false;
    for (const g of redGlobs) {
      // ls-files under the glob's literal prefix, then filter by the compiled matcher.
      const prefix = g.replace(/\*.*$/, "").replace(/\/$/, "");
      let tracked = "";
      try { tracked = git(root, ["ls-files", "--", prefix || "."]); } catch { tracked = ""; }
      const gm = globToRegExp(g);
      for (const f of tracked.split("\n").map((s) => s.trim()).filter(Boolean)) {
        if (!gm.test(f)) continue;
        const log = (() => { try { return git(root, ["log", "--oneline", "-1", "--", f]).trim(); } catch { return ""; } })();
        if (log) { redHasHistory = true; break; }
      }
      if (redHasHistory) break;
    }
    if (!redHasHistory) {
      die(EXIT.RED_FIRST, `implementation commit before RED is committed (card ${args.card} red paths have no history) — write & commit the RED test first (L10)`);
    }
  }

  // Gate must be green BEFORE we mutate anything.
  const gate = join(root, "scripts", "gate.sh");
  if (existsSync(gate)) {
    const rc = (() => {
      try { execFileSync(gate, ["--quick"], { cwd: root, stdio: "pipe" }); return 0; }
      catch (e) { return typeof e.status === "number" ? e.status : 1; }
    })();
    if (rc !== 0) die(EXIT.GATE, "scripts/gate.sh --quick is RED — refusing to commit onto a red tree");
  }

  // Named-paths-only add + commit. NEVER `-a`, NEVER `add .`, NEVER a pathspec-free commit.
  if (gitCode(root, ["add", "--", ...rels]) !== 0) die(EXIT.INTERNAL, "git add of named paths failed");
  try {
    git(root, ["commit", "-m", args.msg, "--", ...rels]);
  } catch (e) {
    console.error((e.stdout || "") + (e.stderr || ""));
    die(EXIT.INTERNAL, "git commit of named paths failed");
  }
  console.log(`commit.mjs: committed ${rels.length} path(s) for card ${args.card}`);
}

main();
