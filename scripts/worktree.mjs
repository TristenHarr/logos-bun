#!/usr/bin/env node
// worktree.mjs — materialize a scratch git worktree of the vendor/bun submodule under
// work/worktrees/<id>/, apply the harness patch series (conformance/patches/*.patch) IN ORDER,
// and print the worktree path. `--clean <id|--all>` removes worktrees.
//
// This is the Lane-A runner's startup step (BAKE_A_BUN §6.2): bun's tests run inside bun, so
// the harness that hosts them needs the bunExe()-override + assert-counter patches — but
// vendor/bun is the pristine conformance oracle (CLAUDE.md R5, gate L7) and is NEVER dirtied.
// `git worktree add` reads the checked-out submodule commit and writes a SEPARATE working
// tree; the patches apply there. Each patch is `git apply --check`ed BEFORE it is applied; ANY
// failure is a LOUD nonzero exit + full teardown — the re-baseline tripwire (SPEC_PIN.md
// ritual): if the pin moved and a context-anchored patch no longer applies, the runner stops
// instead of silently drifting.
//
//   worktree.mjs <id> [--patches <dir|p1 p2 …>]  materialize + apply; prints the abs path
//   worktree.mjs --clean <id>                    remove one scratch worktree
//   worktree.mjs --clean --all                   remove every scratch worktree under work/worktrees/
//
// Exit codes:
//   0  success
//   2  usage error
//   3  git worktree add failed / vendor-pristine invariant broke
//   4  a patch failed --check or apply (the re-baseline tripwire) — partial worktree torn down
//
// git verbs used (worktree add/remove/prune, apply) are NOT in the L8 forbidden set; the
// mutations land ONLY on the scratch worktree, never on vendor/bun's own checkout.
//
// LEARNED (empirically, git 2.x on the submodule): `git worktree add` MUST get an ABSOLUTE
// target — a relative path resolves against the submodule cwd and would nest the worktree
// INSIDE vendor/bun (dirtying the oracle). All git ops go through `git -C`; all `git apply`
// path args are absolute. The target dir is joined off the repo ROOT, so it is always absolute.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join, dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const VENDOR = join(ROOT, "vendor", "bun");
const WORKTREES = join(ROOT, "work", "worktrees");
const PATCH_DIR = join(ROOT, "conformance", "patches");

function die(code, msg) {
  console.error(`worktree.mjs: ${msg}`);
  process.exit(code);
}

// An id must be a single safe path segment (no separators, no traversal): it names a
// directory under work/worktrees/ and is the worktree's git identifier.
function validId(id) {
  return typeof id === "string" && /^[A-Za-z0-9._-]+$/.test(id) && id !== "." && id !== "..";
}

// Run git in a directory; return { code, stdout, stderr } without throwing.
function git(cwd, args) {
  const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  return { code: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

// The vendor-pristine invariant, asserted after every mutating operation.
function vendorDirt() {
  return git(VENDOR, ["status", "--porcelain"]).stdout.trim();
}

function worktreePath(id) {
  return join(WORKTREES, id); // always absolute (ROOT is absolute)
}

// Resolve the patch series to an ordered list of ABSOLUTE patch files. `spec` may be:
//   * undefined            → conformance/patches/*.patch (sorted)
//   * a single directory   → that dir's *.patch (sorted)
//   * a list of files      → those files, in the given order
function resolveSeries(spec) {
  const dirSeries = (dir) => {
    if (!existsSync(dir)) die(4, `patch dir not found: ${dir} (apply failed — re-baseline tripwire)`);
    return readdirSync(dir)
      .filter((f) => f.endsWith(".patch"))
      .sort()
      .map((f) => join(dir, f));
  };
  if (spec === undefined) return dirSeries(PATCH_DIR);
  if (spec.length === 1) {
    const only = isAbsolute(spec[0]) ? spec[0] : resolve(process.cwd(), spec[0]);
    if (existsSync(only) && statSync(only).isDirectory()) return dirSeries(only);
    return [only];
  }
  return spec.map((p) => (isAbsolute(p) ? p : resolve(process.cwd(), p)));
}

// Enumerate scratch worktrees git tracks that live under work/worktrees/.
function scratchWorktrees() {
  const out = git(VENDOR, ["worktree", "list", "--porcelain"]).stdout;
  const paths = [];
  for (const line of out.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      const p = line.slice("worktree ".length).trim();
      if (p !== VENDOR && (p === WORKTREES || p.startsWith(WORKTREES + "/"))) paths.push(p);
    }
  }
  return paths;
}

// Remove a worktree cleanly: `git worktree remove --force` (drops the admin entry + dir),
// then prune stale admin records, then belt-and-suspenders rmSync of any residue.
function removeAt(wt) {
  if (existsSync(wt)) git(VENDOR, ["worktree", "remove", "--force", wt]);
  git(VENDOR, ["worktree", "prune"]);
  if (existsSync(wt)) rmSync(wt, { recursive: true, force: true });
}

function cleanup(id) {
  removeAt(worktreePath(id));
}

function doClean(id) {
  if (id === "--all") {
    for (const p of scratchWorktrees()) removeAt(p);
    // Scrub any orphaned dirs git no longer tracks (leaked partials).
    if (existsSync(WORKTREES)) {
      for (const name of readdirSync(WORKTREES)) removeAt(join(WORKTREES, name));
    }
    git(VENDOR, ["worktree", "prune"]);
    if (vendorDirt() !== "") die(3, `vendor/bun dirty after --clean --all:\n${vendorDirt()}`);
    console.log("cleaned all scratch worktrees");
    process.exit(0);
  }
  if (!validId(id)) die(2, `--clean needs a valid id or --all (got ${JSON.stringify(id)})`);
  cleanup(id);
  if (existsSync(worktreePath(id))) die(3, `failed to remove worktree ${worktreePath(id)}`);
  if (vendorDirt() !== "") die(3, `vendor/bun dirty after --clean ${id}:\n${vendorDirt()}`);
  console.log(`cleaned worktree ${id}`);
  process.exit(0);
}

function doMaterialize(id, patchSpec) {
  if (!existsSync(join(VENDOR, ".git"))) die(3, `vendor/bun submodule missing at ${VENDOR}`);
  if (!existsSync(WORKTREES)) mkdirSync(WORKTREES, { recursive: true });
  const wt = worktreePath(id);

  // Resolve the series BEFORE touching git so a bad --patches dir dies without a partial worktree.
  const patches = resolveSeries(patchSpec);

  // Fresh start: if a stale worktree with this id exists, tear it down first (idempotent).
  cleanup(id);

  // Materialize at the pinned/checked-out submodule commit (detached — never a branch).
  const head = git(VENDOR, ["rev-parse", "HEAD"]).stdout.trim();
  const add = git(VENDOR, ["worktree", "add", "--detach", wt, head]);
  if (add.code !== 0) {
    cleanup(id);
    if (vendorDirt() !== "") die(3, `vendor dirty after failed add:\n${vendorDirt()}`);
    die(3, `git worktree add failed:\n${add.stderr || add.stdout}`);
  }

  // Apply the series in order: `--check` each patch FIRST, then apply. ANY failure at any
  // stage = tear down + loud exit 4 (the re-baseline tripwire).
  for (const abs of patches) {
    if (!existsSync(abs)) {
      cleanup(id);
      die(4, `patch not found: ${abs} (apply failed — re-baseline tripwire)`);
    }
    const check = git(wt, ["apply", "--check", "--whitespace=nowarn", abs]);
    if (check.code !== 0) {
      cleanup(id);
      if (vendorDirt() !== "") die(3, `vendor dirty after failed --check:\n${vendorDirt()}`);
      die(4, `patch does NOT apply (--check): ${abs}\n${check.stderr || check.stdout}\n` +
             `(the re-baseline tripwire — did SPEC_PIN move under the patch's context anchor?)`);
    }
    const ap = git(wt, ["apply", "--whitespace=nowarn", abs]);
    if (ap.code !== 0) {
      cleanup(id);
      if (vendorDirt() !== "") die(3, `vendor dirty after failed apply:\n${vendorDirt()}`);
      die(4, `patch failed to apply after passing --check: ${abs}\n${ap.stderr || ap.stdout}`);
    }
  }

  // The scratch worktree is the runner's, but vendor/bun MUST remain pristine.
  if (vendorDirt() !== "") {
    cleanup(id);
    die(3, `vendor/bun went dirty during materialize (invariant break):\n${vendorDirt()}`);
  }

  // The path is the ONLY thing on stdout (consumed by callers); diagnostics go to stderr.
  console.log(wt);
  process.exit(0);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    die(2, "usage: worktree.mjs <id> [--patches <dir|p…>]  |  worktree.mjs --clean <id|--all>");
  }
  if (argv[0] === "--clean") return doClean(argv[1]);

  const id = argv[0];
  if (!validId(id)) die(2, `invalid id ${JSON.stringify(id)} (want [A-Za-z0-9._-]+)`);

  let patchSpec;
  const px = argv.indexOf("--patches");
  if (px >= 0) {
    patchSpec = argv.slice(px + 1);
    if (patchSpec.length === 0) die(2, "--patches needs a directory or at least one path");
  }
  return doMaterialize(id, patchSpec);
}

main();
