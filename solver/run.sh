#!/bin/bash
# Keeps the heads-up solve going: restarts the solver when it exits with an error or crashes, kills and restarts it
# when its heartbeat goes stale (no flop finished and no pause tick for STALL_MIN minutes), and exits 0 once the
# run is finished. Meant to run under launchd (see hu-solver.plist), which restarts this script if it dies and
# starts it again after a reboot and login. Every finished flop is on disk, so a restart loses at most one flop.
# The solver runs through `heavy` (~/.mem-guard/heavy.py, the Mac's CPU budget) when it is installed: efficiency
# cores only, nice 10, rayon at RAYON_NUM_THREADS (default 6), and one of the machine's heavy slots, so tests and
# the UI keep the performance cores. HEAVY_OPTS=-a lets it use every core (faster, but it competes with tests).
# Usage: ./run.sh [solver args...]   (default: the current heads-up run)
cd "$(dirname "$0")" || exit 1
ARGS=("$@"); [ ${#ARGS[@]} -eq 0 ] && ARGS=(--dir runs/hu --tree B --rounds 11 --late-alpha 0.6)
DIR=runs/hu; for ((i = 0; i < ${#ARGS[@]}; i++)); do [ "${ARGS[i]}" = --dir ] && DIR=${ARGS[i+1]}; done
STALL_MIN=${STALL_MIN:-20}
HEAVY=$HOME/.local/bin/heavy
QUICK=0  # restarts in a row where the solver died within 2 minutes; 5 means something is broken, so stop
say() { echo "$(date '+%F %T') $*" | tee -a "$DIR/supervisor.txt"; }
mkdir -p "$DIR"

while true; do
  if pgrep -x hu-solver >/dev/null; then say "another hu-solver is running; waiting"; sleep 60; continue; fi
  if [ -x "$HEAVY" ]; then
    say "starting hu-solver ${ARGS[*]} (heavy ${HEAVY_OPTS:-efficiency cores})"
    # -x: heavy waits for a slot, then becomes the solver, so $PID is the solver itself.
    # shellcheck disable=SC2086
    "$HEAVY" -x $HEAVY_OPTS ./target/release/hu-solver "${ARGS[@]}" >> "$DIR/stdout.txt" 2>&1 &
  else
    say "starting hu-solver ${ARGS[*]}"
    nice -n 5 ./target/release/hu-solver "${ARGS[@]}" >> "$DIR/stdout.txt" 2>&1 &
  fi
  PID=$!
  caffeinate -i -w $PID &
  touch "$DIR/heartbeat"; START=$(date +%s)
  while kill -0 $PID 2>/dev/null; do
    sleep 60
    # Not stale while heavy is still waiting for a slot, or while the solver is paused (SIGSTOP by `calm` during
    # a test run, or by the memory guard): a paused solver can't touch its heartbeat.
    if ! ps -o comm= -p $PID | grep -q hu-solver; then touch "$DIR/heartbeat"; START=$(date +%s); continue; fi
    case $(ps -o state= -p $PID) in T*) touch "$DIR/heartbeat"; continue ;; esac
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
