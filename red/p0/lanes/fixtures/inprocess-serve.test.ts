// Fixture: in-process Bun.serve — a Lane-A pass would observe real bun's server in the
// host process, not the child. lint-lanes.mjs must mark it BLOCKED(P9). Lint target only.
import { test, expect } from "bun:test";

test("serves in-process", async () => {
  const server = Bun.serve({ port: 0, fetch: () => new Response("ok") });
  const res = await fetch(server.url);
  expect(res.status).toBe(200);
  server.stop();
});
