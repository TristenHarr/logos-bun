// Fixture: the in-process server reached via BRACKET member access (`Bun["serve"](`),
// which a dot-only lint (`Bun.serve(`) would MISS. lint-lanes.mjs must catch it
// (BLOCKED(P9)). Lint target only — an anti-false-negative lock.
import { test, expect } from "bun:test";

test("serves via bracket access", () => {
  const server = Bun["serve"]({ port: 0, fetch: () => new Response("ok") });
  expect(server.port).toBeGreaterThan(0);
  server.stop();
});
