#!/usr/bin/env bash
# git-ro.sh — read-only git verb allowlist (CLAUDE.md R4). Diff production and state reads
# need git, but ONLY the inspecting verbs. Everything else — including the named-path
# commit path, which goes through commit.mjs, and EVERY destructive verb (stash/reset/
# checkout --/clean/rebase/push --force), which is forbidden outright (L8) — is refused
# here with a pointer to the constitution.
#
#   allowed: status diff log show rev-parse ls-files
#   exit 0  = the underlying read-only git ran (its own exit code is propagated)
#   exit 20 = a non-allowlisted verb was requested (refused)
#   exit 2  = usage
set -uo pipefail

if [[ $# -lt 1 || "$1" == "--help" || "$1" == "-h" ]]; then
  cat <<'EOF'
git-ro.sh — read-only git wrapper (CLAUDE.md R4).
usage: git-ro.sh <verb> [args...]
allowed verbs: status | diff | log | show | rev-parse | ls-files
Everything else (commit/add/push/stash/reset/checkout/clean/rebase/…) is refused:
commits go through scripts/workflow/commit.mjs; destructive verbs are forbidden (L8).
EOF
  [[ $# -lt 1 ]] && exit 2 || exit 0
fi

verb="$1"; shift
case "$verb" in
  status|diff|log|show|rev-parse|ls-files)
    exec git "$verb" "$@"
    ;;
  *)
    echo "git-ro.sh REFUSE: '$verb' is not a read-only verb." >&2
    echo "  Allowed: status diff log show rev-parse ls-files." >&2
    echo "  Commits go through scripts/workflow/commit.mjs; destructive git is forbidden." >&2
    echo "  See CLAUDE.md R4 (the git split)." >&2
    exit 20
    ;;
esac
