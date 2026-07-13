#!/usr/bin/env bash
# Build the RUST bun (v1.4.0, the rewrite) from source as the oracle binary — the user chose
# Rust→LOGOS (2026-07-13). Bootstrapped by the 1.3.14 binary we already have; WebKit is a
# prebuilt download (not a source build). Run AFTER installing the build deps (see PREREQS).
#
# PREREQS (user, sudo): `sudo apt install ninja-build ccache`  (cmake/clang/clang++/rustc present)
# Then: bash scripts/bootstrap/build-oracle-rust.sh
set -euo pipefail

RUST_BUN="${RUST_BUN_SRC:-/home/tristen/logicaffeine/bun}"   # 43ee038, v1.4.0-dev, 1516 .rs
BOOTSTRAP="/home/tristen/logos-bun/vendor-artifacts/oracle-bun/bun"  # the 1.3.14 binary
DEST_DIR="/home/tristen/logos-bun/vendor-artifacts/oracle-bun-rust"
DEST="$DEST_DIR/bun"

for t in ninja cmake clang clang++ rustc; do
  command -v "$t" >/dev/null || { echo "build-oracle: MISSING $t — sudo apt install ninja-build ccache" >&2; exit 90; }
done
[[ -x "$BOOTSTRAP" ]] || { echo "build-oracle: bootstrap 1.3.14 binary missing at $BOOTSTRAP" >&2; exit 91; }

echo "build-oracle: building RUST bun (release) at $RUST_BUN via bootstrap $($BOOTSTRAP --version)"
cd "$RUST_BUN"
# bun's own build driver, release profile, run under the 1.3.14 bootstrap bun.
"$BOOTSTRAP" scripts/build.ts --profile=release

BUILT="$(find "$RUST_BUN/build" -maxdepth 3 -name bun -type f -executable 2>/dev/null | head -1)"
[[ -n "$BUILT" ]] || { echo "build-oracle: no built bun binary found under $RUST_BUN/build" >&2; exit 92; }

mkdir -p "$DEST_DIR"
install -m 0755 "$BUILT" "$DEST"
SHA="$(sha256sum "$DEST" | cut -d' ' -f1)"
VER="$("$DEST" --version)"
echo "build-oracle: DONE. Rust oracle at $DEST  sha256=$SHA  version=$VER"
echo "build-oracle: NEXT (atomic re-baseline) — update SPEC_PIN.md {tag SHA 43ee03834ca77f9f218cc998a0df7fb8b301ff53, binary sha256 $SHA, version $VER, test count}, re-pin vendor/bun submodule to 43ee038, re-apply conformance/patches to a scratch worktree (loud on fail), gate --wave 0 green."
