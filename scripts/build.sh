#!/usr/bin/env bash
# The ONLY way to build a logos-bun largo project (CLAUDE.md R8: one build at a time, ever).
# Wraps largo from the sibling toolchain checkout; holds a global build mutex.
# Usage: scripts/build.sh [--project <dir>] [largo build args...]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK_DIR="$ROOT/work/locks"
LOCK="$LOCK_DIR/build.lock"
mkdir -p "$LOCK_DIR"

# Build against the DEDICATED toolchain clone (sibling-churn-isolated, carries namespaced-types
# @ 2a10c5c). NOT the live /home/tristen/logicaffeine (a concurrent session runs cargo-mutants
# --in-place there → unreliable builds). Override with LOGOS_WORKSPACE for other toolchains.
TOOLCHAIN="${LOGOS_WORKSPACE:-/home/tristen/logos-bun-toolchain}"
PROJECT="$ROOT"
ARGS=()
profile_set=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT="$(cd "$2" && pwd)"; shift 2 ;;
    --release|--debug|--dev) profile_set=1; ARGS+=("$1"); shift ;;
    *) ARGS+=("$1"); shift ;;
  esac
done

# Default to a RELEASE build. jsint is a tree-walking interpreter whose normalization passes are O(n²)
# in source length (item-i-of-Text is O(i)), so on harness-heavy inputs (test262's ~200-line assert.js +
# propertyHelper.js prepended to every test) the DEBUG binary is ~42× slower — 3.0s vs 0.07s per test,
# which turned the test262 sweep into 77min and made stack-overflow bugs mis-classify as timeouts. Release
# is byte-identical to debug across the 369-fuzzer sweep (738/738). Pass --debug to opt out for a fast compile.
if [[ $profile_set -eq 0 ]]; then
  ARGS+=(--release)
fi

exec 9>"$LOCK"
if ! flock -w 1800 9; then
  echo "build.sh: could not acquire build mutex within 30min ($LOCK)" >&2
  exit 91
fi

cd "$PROJECT"
LOGOS_WORKSPACE="$TOOLCHAIN" cargo run --quiet \
  --manifest-path "$TOOLCHAIN/Cargo.toml" -p logicaffeine-cli -- \
  build "${ARGS[@]+"${ARGS[@]}"}"
