import { expect, test } from "bun:test";

test("boots an in-process HTTP server — asserts observe the parent, not a child", async () => {
  const server = Bun.serve({
    port: 0,
    fetch() {
      return new Response("hi");
    },
  });
  const res = await fetch(`http://localhost:${server.port}/`);
  expect(await res.text()).toBe("hi");
  server.stop();
});
