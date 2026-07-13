#!/usr/bin/env node
// diff.mjs — emits work/diffs/<task>-r<N>.patch from named paths for reviewer consumption
// (§2.5: "reviewers get ONLY the diff"). The patch is `git diff -- <paths>` against HEAD
// for tracked changes, PLUS untracked named files appended as /dev/null (new-file) diffs so
// a brand-new implementation file still reaches the reviewer. Read-only git only.
//
//   exit 0 = patch written
//   exit 2 = usage
//   exit 1 = internal error
//
// Usage: diff.mjs --task <name> --round <N> --paths <p1,p2,...> [--root <dir>]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

function die(code, msg) { console.error("diff.mjs: " + msg); process.exit(code); }

function parseArgs(argv) {
  const a = { task: null, round: null, paths: null, root: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--task") a.task = argv[++i];
    else if (k === "--round") a.round = argv[++i];
    else if (k === "--paths") a.paths = argv[++i];
    else if (k === "--root") a.root = argv[++i];
    else die(2, `unknown argument ${JSON.stringify(k)}`);
  }
  return a;
}

function git(root, args) {
  try { return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: "pipe" }); }
  catch (e) { return (e.stdout || ""); } // diff exits 1 when there ARE differences — not an error
}
function isTracked(root, rel) {
  try { return execFileSync("git", ["-C", root, "ls-files", "--error-unmatch", "--", rel], { stdio: "pipe" }) !== undefined; }
  catch { return false; }
}

function relativize(root, p) {
  const abs = resolve(root, p);
  const rootAbs = resolve(root);
  if (abs !== rootAbs && !abs.startsWith(rootAbs + sep)) die(1, `path escapes repo root: ${p}`);
  return abs.slice(rootAbs.length).replace(/^[/\\]/, "").replace(/\\/g, "/");
}

// Render an untracked file as a /dev/null unified diff (all-added), matching git's shape
// closely enough for reviewers and `git apply`.
function newFileDiff(root, rel) {
  const abs = join(root, rel);
  const st = statSync(abs);
  if (st.isDirectory()) return "";
  const content = execFileSync("cat", [abs], { encoding: "utf8" });
  const lines = content.length ? content.replace(/\n$/, "").split("\n") : [];
  const noTrailing = content.length > 0 && !content.endsWith("\n");
  let out = `diff --git a/${rel} b/${rel}\n`;
  out += `new file mode 100644\n`;
  out += `--- /dev/null\n`;
  out += `+++ b/${rel}\n`;
  out += `@@ -0,0 +1,${lines.length} @@\n`;
  for (let i = 0; i < lines.length; i++) {
    out += "+" + lines[i] + "\n";
  }
  if (noTrailing) out += "\\ No newline at end of file\n";
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(args.root || join(dirname(fileURLToPath(import.meta.url)), "..", ".."));
  if (!args.task) die(2, "missing --task <name>");
  if (args.round == null) die(2, "missing --round <N>");
  if (args.paths == null) die(2, "missing --paths <p1,p2,...>");
  const paths = args.paths.split(",").map((s) => s.trim()).filter(Boolean);
  if (paths.length === 0) die(2, "empty path list");

  const rels = paths.map((p) => relativize(root, p));
  const tracked = rels.filter((r) => isTracked(root, r));
  const untracked = rels.filter((r) => !isTracked(root, r) && existsSync(join(root, r)));

  let patch = "";
  if (tracked.length) patch += git(root, ["diff", "HEAD", "--", ...tracked]);
  for (const rel of untracked) patch += newFileDiff(root, rel);

  const outDir = join(root, "work", "diffs");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `${args.task}-r${args.round}.patch`);
  writeFileSync(outFile, patch);
  console.log(`diff.mjs: wrote ${outFile} (${tracked.length} tracked, ${untracked.length} new, ${patch.length} bytes)`);
}

main();
