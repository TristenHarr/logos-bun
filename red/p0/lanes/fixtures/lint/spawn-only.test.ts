import { bunExe, bunEnv } from "harness";
import { expect, test } from "bun:test";

test("observes a CHILD bun via spawnSync — the canonical Lane-A shape", () => {
  const { stdout, exitCode } = Bun.spawnSync({
    cmd: [bunExe(), "--version"],
    env: bunEnv,
  });
  expect(exitCode).toBe(0);
  expect(stdout.toString().trim()).toMatch(/^\d+\.\d+\.\d+$/);
});
