#!/usr/bin/env bash
# diffcli self-test fixture: runs the oracle-bun binary, then corrupts one line of
# stdout via sed. Used to prove diffcli DETECTS a real divergence (oracle vs wrapped).
# It is deliberately NOT a normalizer-hideable diff: it mangles the version DIGITS,
# which no normalizer in normalizers.tsv is allowed to touch for `--version`.
set -euo pipefail
ORACLE="${DIFFCLI_ORACLE:?DIFFCLI_ORACLE must point at the oracle-bun binary}"
"$ORACLE" "$@" | sed 's/1\.3\.14/9.9.9/'
