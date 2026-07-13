// Fixture: the in-process bundler reached via an ALIASED named import off "bun"
// (`import { build as mkBundle }`) used bare. A word-boundary lint keying only on
// `Bun.build(` would MISS this and false-green a Lane-A row. lint-lanes.mjs must catch it
// (BLOCKED(P9)). Lint target only — an anti-false-negative lock.
import { build as mkBundle } from "bun";
import { test, expect } from "bun:test";

test("bundles via an aliased import", async () => {
  const out = await mkBundle({ entrypoints: ["./index.ts"] });
  expect(out.success).toBe(true);
});
