// Fixture: direct import of a bun-internal module (bun:internal-for-testing). Reaching
// into bun's own internals is in-process by definition; a Lane-A pass observes real
// bun, not the child. lint-lanes.mjs must mark it BLOCKED(P9). Lint target only.
import { test, expect } from "bun:test";
import { crash_handler } from "bun:internal-for-testing";

test("pokes bun internals", () => {
  expect(typeof crash_handler).toBe("object");
});
