// W1.3 RED: 0002-assert-counter.patch instruments the harness so a child test process
// appends `<file>\t<executed-expect-count>` to $BUN_ASSERT_COUNT_FILE at exit — the
// interface W1.2's runner consumes for the ledger `asserts` column.
//
// This test is oracle-gated: it needs the pinned oracle bun binary to actually EXECUTE the
// patched harness under a real bun:test run (the only honest proof the counter fires). When
// the oracle binary is absent, it degrades to a source-level assertion on the patch content
// so the RED battery still runs in a bun-less CI leg — but the behavioral leg is the spec.
// SHIM (tests-shim-allowlist.tsv): migrates to .lg at W2.9.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

const WORKTREE = join(ROOT, "scripts", "worktree.mjs");
const ORACLE = join(ROOT, "vendor-artifacts", "oracle-bun", "bun");
const vendorDirty = () =>
  execFileSync("git", ["-C", join(ROOT, "vendor/bun"), "status", "--porcelain"], { encoding: "utf8" }).trim();

check(vendorDirty() === "", `vendor/bun dirty before test:\n${vendorDirty()}`);

// Materialize a patched worktree (patch series applied in order → harness carries the counter).
let materialized = null;
const id = "red-w13-assert-" + process.pid;
if (fails.length === 0) {
  const res = spawnSync("node", [WORKTREE, id], { encoding: "utf8" });
  if (res.status !== 0) {
    fails.push(`worktree.mjs materialize failed:\n${res.stdout}\n${res.stderr}`);
  } else {
    materialized = res.stdout.trim().split(/\r?\n/).pop().trim();
  }
}

try {
  if (materialized) {
    const harness = join(materialized, "test", "harness.ts");
    check(existsSync(harness), `patched worktree missing harness.ts: ${harness}`);
    const hsrc = existsSync(harness) ? readFileSync(harness, "utf8") : "";
    // Source-level invariants of the counter seam (cheap, always run).
    check(/BUN_ASSERT_COUNT_FILE/.test(hsrc), "patched harness.ts does not reference BUN_ASSERT_COUNT_FILE");

    if (existsSync(ORACLE)) {
      // Behavioral proof: run a toy test file whose known executed-expect count is 4, under
      // the oracle bun with the patched harness preloaded, and confirm the sidecar file gets
      // `<file>\t4`. bun's own runner prints "4 expect() calls"; we mirror that count.
      const work = mkdtempSync(join(tmpdir(), "w13-assert-"));
      try {
        const testFile = join(work, "toy.test.ts");
        writeFileSync(
          testFile,
          [
            'import { expect, test } from "bun:test";',
            "test('a', () => { expect(1).toBe(1); expect(2).toBe(2); });",
            "test('b', () => { expect([1]).toContain(1); expect(true).not.toBe(false); });",
          ].join("\n"),
        );
        const countFile = join(work, "counts.tsv");
        const preload = join(materialized, "test", "preload.ts");
        const run = spawnSync(
          ORACLE,
          ["test", "--preload", preload, testFile],
          { encoding: "utf8", env: { ...process.env, BUN_ASSERT_COUNT_FILE: countFile, CI: "1" }, cwd: work },
        );
        check(existsSync(countFile), `oracle run did not write BUN_ASSERT_COUNT_FILE (bun stderr:\n${run.stderr})`);
        if (existsSync(countFile)) {
          const rows = readFileSync(countFile, "utf8").trim().split(/\r?\n/).filter(Boolean);
          check(rows.length >= 1, "count file is empty");
          const row = rows.find((r) => r.includes("toy.test.ts")) || rows[rows.length - 1];
          const parts = row.split("\t");
          check(parts.length === 2, `count row is not <file>\\t<count>: ${JSON.stringify(row)}`);
          check(/toy\.test\.ts$/.test(parts[0]), `count row file is not the test file: ${parts[0]}`);
          check(parts[1] === "4", `executed-expect count wrong: expected 4, got ${parts[1]} (bun reports 4 expect() calls)`);
        }
      } finally {
        rmSync(work, { recursive: true, force: true });
      }
    } else {
      console.error("NOTE assert-counter: oracle bun absent — behavioral leg skipped (source leg still asserted)");
    }
  }
} finally {
  if (materialized) spawnSync("node", [WORKTREE, "--clean", id], { encoding: "utf8" });
}

check(vendorDirty() === "", `vendor/bun dirty after assert-counter test:\n${vendorDirty()}`);

if (fails.length) {
  for (const f of fails) console.error("FAIL assert-counter: " + f);
  process.exit(1);
}
console.log("PASS assert-counter");
