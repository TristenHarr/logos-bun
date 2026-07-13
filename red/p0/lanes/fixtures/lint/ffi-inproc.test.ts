import { dlopen, FFIType } from "bun:ffi";
import { expect, test } from "bun:test";

test("loads a native library in-process via bun:ffi — engine-bound, not CLI-observable", () => {
  const lib = dlopen("libm.so", {
    sqrt: { args: [FFIType.f64], returns: FFIType.f64 },
  });
  expect(lib.symbols.sqrt(4)).toBe(2);
});
