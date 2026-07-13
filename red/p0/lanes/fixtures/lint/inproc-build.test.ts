import { expect, test } from "bun:test";

test("uses the in-process bundler API — cannot be Lane-A", async () => {
  const out = await Bun.build({
    entrypoints: ["./index.ts"],
    outdir: "./dist",
  });
  expect(out.success).toBe(true);
});
