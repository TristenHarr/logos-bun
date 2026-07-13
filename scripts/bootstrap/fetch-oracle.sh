#!/usr/bin/env bash
# Fetch the official oracle-bun release binary at SPEC_PIN's tag and verify it.
# Network access — run with user approval (W0.B). Re-runnable: verifies if present.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TAG="bun-v1.3.14"
ASSET="bun-linux-x64.zip"
DEST_DIR="$ROOT/vendor-artifacts/oracle-bun"
DEST="$DEST_DIR/bun"
URL="https://github.com/oven-sh/bun/releases/download/$TAG/$ASSET"

mkdir -p "$DEST_DIR"

if [[ ! -x "$DEST" ]]; then
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  echo "fetch-oracle: downloading $URL"
  curl -fsSL -o "$tmp/$ASSET" "$URL"
  (cd "$tmp" && unzip -q "$ASSET")
  install -m 0755 "$tmp/bun-linux-x64/bun" "$DEST"
fi

SHA="$(sha256sum "$DEST" | cut -d' ' -f1)"
VERSION="$("$DEST" --version)"
echo "fetch-oracle: sha256=$SHA version=$VERSION at $DEST"

PIN_SHA="$(grep -oP '(?<=Binary sha256 \| `)[0-9a-f]{64}' "$ROOT/SPEC_PIN.md" || true)"
if [[ -n "$PIN_SHA" && "$PIN_SHA" != "$SHA" ]]; then
  echo "fetch-oracle: FATAL sha256 mismatch vs SPEC_PIN.md (pin=$PIN_SHA got=$SHA)" >&2
  exit 92
fi
if [[ -z "$PIN_SHA" ]]; then
  echo "fetch-oracle: SPEC_PIN.md sha256 is PENDING-FETCH — record: $SHA / '$VERSION'"
fi
