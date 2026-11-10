#!/bin/bash
# Keeps the heads-up solve going: restarts the solver when it exits with an error or crashes, kills and restarts it
# when its heartbeat goes stale (no flop finished and no pause tick for STALL_MIN minutes), and exits 0 once the
# run is finished. Meant to run under launchd (see hu-solver.plist), which restarts this script if it dies and
# starts it again after a reboot and login. Every finished flop is on disk, so a restart loses at most one flop.
# Usage: ./run.sh [solver args...]   (default: the current heads-up run)
cd "$(dirname "$0")" || exit 1
ARGS=("$@"); [ ${#ARGS[@]} -eq 0 ] && ARGS=(--dir runs/hu --tree B --rounds 11 --late-alpha 0.6)
DIR=runs/hu; for ((i = 0; i < ${#ARGS[@]}; i++)); do [ "${ARGS[i]}" = --dir ] && DIR=${ARGS[i+1]}; done
STALL_MIN=${STALL_MIN:-20}
QUICK=0  # restarts in a row where the solver died within 2 minutes; 5 means something is broken, so stop
say() { echo "$(date '+%F %T') $*" | tee -a "$DIR/supervisor.txt"; }
mkdir -p "$DIR"

while true; do
  if pgrep -x hu-solver >/dev/null; then say "another hu-solver is running; waiting"; sleep 60; continue; fi
  say "starting hu-solver ${ARGS[*]}"
  nice -n 5 ./target/release/hu-solver "${ARGS[@]}" >> "$DIR/stdout.txt" 2>&1 &
  PID=$!
  caffeinate -i -w $PID &
  touch "$DIR/heartbeat"; START=$(date +%s)
  while kill -0 $PID 2>/dev/null; do
    sleep 60
    age=$(( $(date +%s) - $(stat -f %m "$DIR/heartbeat" 2>/dev/null || echo 0) ))
    if [ $age -gt $((STALL_MIN * 60)) ]; then
      say "no heartbeat for $((age / 60)) minutes; killing $PID"
      kill $PID; sleep 10; kill -9 $PID 2>/dev/null
    fi
  done
  wait $PID; code=$?
  if [ $code -eq 0 ] && tail -1 "$DIR/log.txt" | grep -q '^finished$'; then say "run finished"; exit 0; fi
  if [ $(( $(date +%s) - START )) -lt 120 ]; then QUICK=$((QUICK + 1)); else QUICK=0; fi
  if [ $QUICK -ge 5 ]; then say "hu-solver died within 2 minutes 5 times in a row; giving up (see $DIR/stdout.txt)"; exit 0; fi
  say "hu-solver exited with code $code; restarting in 30s"
  sleep 30
done
