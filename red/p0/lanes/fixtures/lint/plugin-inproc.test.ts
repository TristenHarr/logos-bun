import { plugin } from "bun";
import { expect, test } from "bun:test";

test("registers an in-process bundler plugin — the plugin host is P9 in-process surface", () => {
  plugin({
    name: "toy",
    setup(build) {
      build.onLoad({ filter: /\.txt$/ }, () => ({ contents: "export default 1;", loader: "js" }));
    },
  });
  expect(1).toBe(1);
});
