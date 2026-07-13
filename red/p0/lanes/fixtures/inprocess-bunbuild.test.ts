// Fixture: a test that exercises an IN-PROCESS Bun API (Bun.build). A Lane-A "pass"
// here would observe real bun's in-process bundler, never the logos-bun child — so
// lint-lanes.mjs must mark this row BLOCKED(P9). NOT a real test; a lint target only.
import { test, expect } from "bun:test";

test("bundles in-process", async () => {
  const result = await Bun.build({ entrypoints: ["./index.ts"] });
  expect(result.success).toBe(true);
});
