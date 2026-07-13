// W1.3 RED: the P0.3 patch series + scratch-worktree materializer.
//   1. worktree.mjs materializes a scratch worktree of vendor/bun, applies the patch
//      series, prints the path; the patched harness.ts bunExe() honors BUN_EXE_OVERRIDE.
//   2. a corrupt patch fixture makes worktree.mjs exit loud (nonzero) and self-clean.
//   3. expectBundled.ts still honors BUN_EXE at the pin (the pin-bump canary — grep-level).
//   4. vendor/bun stays pristine (git status --porcelain empty) after materialize + clean.
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync, writeFileSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

const WORKTREE = join(ROOT, "scripts", "worktree.mjs");
const PATCH_DIR = join(ROOT, "conformance", "patches");
const P1 = join(PATCH_DIR, "0001-bunexe-override.patch");
const P2 = join(PATCH_DIR, "0002-assert-counter.patch");

// git porcelain of vendor/bun — the pristine invariant we assert throughout.
const vendorDirty = () =>
  execFileSync("git", ["-C", join(ROOT, "vendor/bun"), "status", "--porcelain"], { encoding: "utf8" }).trim();

check(existsSync(WORKTREE), "scripts/worktree.mjs missing");
check(existsSync(P1), "conformance/patches/0001-bunexe-override.patch missing");
check(existsSync(P2), "conformance/patches/0002-assert-counter.patch missing");

// ── (3) expectBundled canary: BUN_EXE honored at the pin, zero patching needed ──
// The doc claims line 147; reality at bun-v1.3.14 is a content line. Assert CONTENT,
// not a line number — this is the pin-bump tripwire, not a fragile line assert.
{
  const eb = join(ROOT, "vendor/bun/test/bundler/expectBundled.ts");
  check(existsSync(eb), "vendor/bun expectBundled.ts missing (pin drift?)");
  if (existsSync(eb)) {
    const src = readFileSync(eb, "utf8");
    check(
      /const BUN_EXE = \(process\.env\.BUN_EXE && Bun\.which\(process\.env\.BUN_EXE\)\) \?\? bunExe\(\);/.test(src),
      "expectBundled.ts no longer honors BUN_EXE via the pinned content line (pin-bump canary tripped)",
    );
  }
}

// vendor must be pristine BEFORE we do anything (no leaked worktree state).
check(vendorDirty() === "", `vendor/bun dirty before test:\n${vendorDirty()}`);

// ── (1) materialize + patched bunExe() honors BUN_EXE_OVERRIDE ──
let materialized = null;
if (fails.length === 0) {
  const id = "red-w13-" + process.pid;
  const res = spawnSync("node", [WORKTREE, id], { encoding: "utf8" });
  if (res.status !== 0) {
    fails.push(`worktree.mjs materialize failed (status ${res.status}):\n${res.stdout}\n${res.stderr}`);
  } else {
    materialized = res.stdout.trim().split(/\r?\n/).pop().trim();
    check(existsSync(materialized), `worktree.mjs printed a path that does not exist: ${materialized}`);
    const patchedHarness = join(materialized, "test", "harness.ts");
    check(existsSync(patchedHarness), `patched worktree has no test/harness.ts: ${patchedHarness}`);
    if (existsSync(patchedHarness)) {
      // The bunExe() body must now consult BUN_EXE_OVERRIDE. Assert on the patched
      // SOURCE (esbuild-free, no bun): the override branch is present and precedes the
      // execPath fallbacks.
      const h = readFileSync(patchedHarness, "utf8");
      const fn = h.slice(h.indexOf("export function bunExe()"), h.indexOf("export function bunExe()") + 400);
      check(
        /BUN_EXE_OVERRIDE/.test(fn),
        "patched harness.ts bunExe() does not reference BUN_EXE_OVERRIDE",
      );
      // Behavioral extraction: textually lift the patched bunExe() body, evaluate it in a
      // node sandbox with a faked process, and confirm it returns the override when set and
      // falls through when unset. This proves BEHAVIOR, not just a grep.
      const bodyMatch = fn.match(/export function bunExe\(\)\s*\{([\s\S]*?)\n\}/);
      check(!!bodyMatch, "could not extract patched bunExe() body for behavioral check");
      if (bodyMatch) {
        const body = bodyMatch[1];
        const evalOne = (override, execPath, isWindows) => {
          const shim = `
            const isWindows = ${JSON.stringify(!!isWindows)};
            const process = { execPath: ${JSON.stringify(execPath)}, env: ${JSON.stringify(override === null ? {} : { BUN_EXE_OVERRIDE: override })} };
            (function bunExe(){${body}})();
          `;
          // eslint-disable-next-line no-new-func
          return Function('"use strict";' + shim + "; return (function bunExe(){" + body + "})();")();
        };
        try {
          const withOverride = evalOne("/fake/logos-bun", "/real/bun", false);
          check(withOverride === "/fake/logos-bun", `patched bunExe() ignored BUN_EXE_OVERRIDE (got ${withOverride})`);
          const withoutOverride = evalOne(null, "/real/bun", false);
          check(withoutOverride === "/real/bun", `patched bunExe() broke the unset fallback (got ${withoutOverride})`);
        } catch (e) {
          fails.push("evaluating patched bunExe() body threw: " + e.message);
        }
      }
    }
    // ── (4) vendor pristine after materialize ──
    check(vendorDirty() === "", `vendor/bun dirty after materialize:\n${vendorDirty()}`);
    // clean it
    const clean = spawnSync("node", [WORKTREE, "--clean", id], { encoding: "utf8" });
    check(clean.status === 0, `worktree.mjs --clean failed:\n${clean.stdout}\n${clean.stderr}`);
    check(!existsSync(materialized), `worktree still present after --clean: ${materialized}`);
    check(vendorDirty() === "", `vendor/bun dirty after clean:\n${vendorDirty()}`);
  }
}

// ── (2) corrupt patch fixture → loud nonzero + self-clean ──
if (fails.length === 0) {
  // Build a throwaway patch dir: a valid 0001 + a corrupt 0002 that cannot apply.
  const tmp = mkdtempSync(join(tmpdir(), "w13-corrupt-"));
  try {
    const cpatch = join(tmp, "patches");
    mkdirSync(cpatch, { recursive: true });
    cpSync(P1, join(cpatch, "0001-bunexe-override.patch"));
    // A unified diff that targets a file/line that does not exist at the pin → apply fails.
    writeFileSync(
      join(cpatch, "0002-corrupt.patch"),
      [
        "--- a/test/harness.ts",
        "+++ b/test/harness.ts",
        "@@ -1,1 +1,2 @@",
        "-THIS LINE DOES NOT EXIST IN THE REAL HARNESS FILE AT ALL",
        "+neither does this replacement",
        "",
      ].join("\n"),
    );
    const id = "red-w13-corrupt-" + process.pid;
    const res = spawnSync("node", [WORKTREE, id, "--patches", cpatch], { encoding: "utf8" });
    check(res.status !== 0, "worktree.mjs did NOT exit loud on a corrupt patch series (re-baseline tripwire dead)");
    // And it must have self-cleaned — no leaked worktree, vendor pristine.
    check(vendorDirty() === "", `vendor/bun dirty after corrupt-patch failure (no cleanup):\n${vendorDirty()}`);
    check(!existsSync(join(ROOT, "work/worktrees", id)), `leaked worktree after corrupt-patch failure: ${id}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (fails.length) {
  for (const f of fails) console.error("FAIL worktree-patches: " + f);
  process.exit(1);
}
console.log("PASS worktree-patches");
