// Fixture: a clean Lane-A test. It spawns the subject binary via bunExe() and asserts
// on the CHILD's observable behavior (exit code, stdout). No in-process Bun API — the
// assertions observe the child, so lint-lanes.mjs must leave the row clean.
import { test, expect } from "bun:test";
import { bunExe, bunEnv } from "harness";

test("--version prints", () => {
  const { stdout, exitCode } = Bun.spawnSync([bunExe(), "--version"], { env: bunEnv });
  expect(exitCode).toBe(0);
  expect(stdout.toString().trim().length).toBeGreaterThan(0);
});
