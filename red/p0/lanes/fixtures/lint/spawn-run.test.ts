import { bunExe, bunEnv } from "harness";
import { expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("runs a script through a child bun and checks the child's stdout", () => {
  const script = join(tmpdir(), "toy.ts");
  writeFileSync(script, 'console.log("built by the child");');
  const { stdout } = Bun.spawnSync({ cmd: [bunExe(), "run", script], env: bunEnv });
  // Note: this file MENTIONS "Bun.build" only in a comment / string, never calls Bun.build(.
  // A word-boundary lint that keys on "Bun.build(" must NOT flag this file.
  expect(stdout.toString()).toContain("built by the child");
});
