#!/usr/bin/env bash
# offline-run.sh — run a network-hermetic command with NO network access (CLAUDE.md R8,
# BAKE_A_BUN §2.5: network-hermetic tests under the offline wrapper). Uses `unshare -n`
# to place the command in a fresh, empty network namespace (loopback only, brought up so
# 127.0.0.1 still works). If unshare is unavailable, it fails LOUDLY rather than running
# the test with real network access (a false "hermetic" pass is worse than no run).
# Exit code = the wrapped command's own (propagated).
#
# usage: offline-run.sh -- <cmd...>
set -uo pipefail

usage() {
  cat <<'EOF'
offline-run.sh — network-namespace wrapper for hermetic tests (CLAUDE.md R8).
usage: offline-run.sh -- <cmd...>
Runs the command inside `unshare -n` (empty netns; loopback up for 127.0.0.1).
No external network is reachable. If unshare is unavailable → loud error, no run.
Exit code = the wrapped command's own.
EOF
}

if [[ $# -eq 0 || "$1" == "--help" || "$1" == "-h" ]]; then usage; [[ $# -eq 0 ]] && exit 2 || exit 0; fi

if [[ "$1" == "--" ]]; then shift; fi
if [[ $# -eq 0 ]]; then echo "offline-run.sh: no command after '--'" >&2; usage; exit 2; fi

if ! command -v unshare >/dev/null 2>&1; then
  echo "offline-run.sh: unshare not available — cannot create a network namespace." >&2
  echo "  Refusing to run a 'hermetic' test with real network access (a false pass is worse)." >&2
  exit 90
fi

# Inside the new netns bring loopback up so 127.0.0.1 tests still work, then exec the cmd.
# --map-root-user lets `ip link` configure lo without host root; the command runs as the
# mapped user. If `ip` is missing, loopback simply stays down (still fully offline).
exec unshare --net --map-root-user -- bash -c '
  if command -v ip >/dev/null 2>&1; then ip link set lo up 2>/dev/null || true; fi
  exec "$@"
' _ "$@"
