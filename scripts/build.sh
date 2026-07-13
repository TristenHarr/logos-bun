#!/usr/bin/env bash
# The ONLY way to build a logos-bun largo project (CLAUDE.md R8: one build at a time, ever).
# Wraps largo from the sibling toolchain checkout; holds a global build mutex.
# Usage: scripts/build.sh [--project <dir>] [largo build args...]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK_DIR="$ROOT/work/locks"
LOCK="$LOCK_DIR/build.lock"
mkdir -p "$LOCK_DIR"

TOOLCHAIN="${LOGOS_WORKSPACE:-/home/tristen/logicaffeine}"
PROJECT="$ROOT"
ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT="$(cd "$2" && pwd)"; shift 2 ;;
    *) ARGS+=("$1"); shift ;;
  esac
done

exec 9>"$LOCK"
if ! flock -w 1800 9; then
  echo "build.sh: could not acquire build mutex within 30min ($LOCK)" >&2
  exit 91
fi

cd "$PROJECT"
LOGOS_WORKSPACE="$TOOLCHAIN" cargo run --quiet \
  --manifest-path "$TOOLCHAIN/Cargo.toml" -p logicaffeine-cli -- \
  build "${ARGS[@]+"${ARGS[@]}"}"
