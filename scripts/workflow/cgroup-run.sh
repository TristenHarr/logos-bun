#!/usr/bin/env bash
# cgroup-run.sh — run a stress-class command under systemd cgroup isolation (CLAUDE.md R8,
# BAKE_A_BUN §2.5: "please is not isolation"). Stress tests (TCP exhaustion, ~10k process
# spawns, GB disk writes) get hard memory/CPU/pid caps so a runaway can't take the box down.
# Wraps `systemd-run --user --scope` with sane defaults + passthrough. Exit code is the
# wrapped command's own (propagated).
#
# usage: cgroup-run.sh [--mem <MemoryMax>] [--cpu <CPUQuota>] [--tasks <TasksMax>] -- <cmd...>
#   defaults: --mem 2G  --cpu 200%  --tasks 512
set -uo pipefail

MEM="2G"
CPU="200%"
TASKS="512"

usage() {
  cat <<'EOF'
cgroup-run.sh — systemd-run cgroup wrapper for stress-class tests (CLAUDE.md R8).
usage: cgroup-run.sh [--mem <MemoryMax>] [--cpu <CPUQuota>] [--tasks <TasksMax>] -- <cmd...>
  --mem    MemoryMax   (default 2G)     hard memory ceiling; OOM-kills on breach
  --cpu    CPUQuota    (default 200%)   CPU quota (100% = one core)
  --tasks  TasksMax    (default 512)    max pids/threads in the scope
The command after `--` runs inside a transient --user scope with those caps.
Exit code = the wrapped command's own.
EOF
}

if [[ $# -eq 0 || "$1" == "--help" || "$1" == "-h" ]]; then usage; [[ $# -eq 0 ]] && exit 2 || exit 0; fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mem)   MEM="$2"; shift 2 ;;
    --cpu)   CPU="$2"; shift 2 ;;
    --tasks) TASKS="$2"; shift 2 ;;
    --)      shift; break ;;
    *) echo "cgroup-run.sh: unexpected argument '$1' (did you forget '--' before the command?)" >&2; exit 2 ;;
  esac
done

if [[ $# -eq 0 ]]; then echo "cgroup-run.sh: no command after '--'" >&2; usage; exit 2; fi

if ! command -v systemd-run >/dev/null 2>&1; then
  echo "cgroup-run.sh: systemd-run not available — cannot provide cgroup isolation." >&2
  echo "  Refusing to run a stress-class command unisolated (CLAUDE.md R8: 'please' is not isolation)." >&2
  exit 90
fi

exec systemd-run --user --scope --quiet \
  -p "MemoryMax=$MEM" \
  -p "CPUQuota=$CPU" \
  -p "TasksMax=$TASKS" \
  -- "$@"
