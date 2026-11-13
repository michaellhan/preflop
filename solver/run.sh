#!/bin/bash
# Keeps the heads-up solve going: restarts the solver when it exits with an error or crashes, kills and restarts it
# when its heartbeat goes stale (no flop finished and no pause tick for STALL_MIN minutes), and exits 0 once the
# run is finished. Meant to run under launchd (see hu-solver.plist), which restarts this script if it dies and
# starts it again after a reboot and login. Every finished flop is on disk, so a restart loses at most one flop.
# The solver runs through `heavy` (~/.mem-guard/heavy.py, the Mac's CPU budget) when it is installed: efficiency
# cores only, nice 10, rayon at RAYON_NUM_THREADS (default 6), and one of the machine's heavy slots, so tests and
# the UI keep the performance cores. HEAVY_OPTS=-a lets it use every core (faster, but it competes with tests).
# ALLCORE_WINDOW=22-8 uses every core (heavy -a, rayon ALLCORE_THREADS, default 10) from 22:00 to 08:00 only, when
# the Mac is idle; at each window edge it waits for a flop to finish (up to 5 minutes), then restarts in the new mode.
# Usage: ./run.sh [solver args...]   (default: the current heads-up run)
cd "$(dirname "$0")" || exit 1
ARGS=("$@"); [ ${#ARGS[@]} -eq 0 ] && ARGS=(--dir runs/hu --tree B --rounds 18 --late-alpha 0.6 --shift-from 11 --correct-from 12)
DIR=runs/hu; for ((i = 0; i < ${#ARGS[@]}; i++)); do [ "${ARGS[i]}" = --dir ] && DIR=${ARGS[i+1]}; done
STALL_MIN=${STALL_MIN:-20}
HEAVY=$HOME/.local/bin/heavy
QUICK=0  # restarts in a row where the solver died within 2 minutes; 5 means something is broken, so stop
ALLCORE_THREADS=${ALLCORE_THREADS:-10}
# heavy slot 2 is reserved for this solve (user's choice, 2026-11-12), so it never queues behind other projects'
# jobs in slots 0-1 and loses nothing at a window switch; HEAVY_ONLY_SLOT= (empty) shares slots 0-1 instead.
export HEAVY_ONLY_SLOT=${HEAVY_ONLY_SLOT-2}
in_window() {  # true inside ALLCORE_WINDOW ("22-8" = 22:00 to 08:00)
  [ -n "$ALLCORE_WINDOW" ] || return 1
  local a=${ALLCORE_WINDOW%-*} b=${ALLCORE_WINDOW#*-} h=$((10#$(date +%H)))
  if [ "$a" -le "$b" ]; then [ "$h" -ge "$a" ] && [ "$h" -lt "$b" ]; else [ "$h" -ge "$a" ] || [ "$h" -lt "$b" ]; fi
}
say() { echo "$(date '+%F %T') $*" | tee -a "$DIR/supervisor.txt"; }
mkdir -p "$DIR"

while true; do
  if pgrep -x hu-solver >/dev/null; then say "another hu-solver is running; waiting"; sleep 60; continue; fi
  if in_window; then ALL=1; OPTS=-a; THREADS=$ALLCORE_THREADS; else ALL=0; OPTS=$HEAVY_OPTS; THREADS=${RAYON_NUM_THREADS:-}; fi
  if [ -x "$HEAVY" ]; then
    say "starting hu-solver ${ARGS[*]} (heavy ${OPTS:-efficiency cores}${THREADS:+, rayon $THREADS})"
    # -x: heavy waits for a slot, then becomes the solver, so $PID is the solver itself.
    # shellcheck disable=SC2086
    RAYON_NUM_THREADS=$THREADS "$HEAVY" -x $OPTS ./target/release/hu-solver "${ARGS[@]}" >> "$DIR/stdout.txt" 2>&1 &
  else
    say "starting hu-solver ${ARGS[*]}"
    nice -n 5 ./target/release/hu-solver "${ARGS[@]}" >> "$DIR/stdout.txt" 2>&1 &
  fi
  PID=$!
  caffeinate -i -w $PID &
  touch "$DIR/heartbeat"; START=$(date +%s); SWITCH=0
  while kill -0 $PID 2>/dev/null; do
    sleep 60
    # window edge: restart in the other mode right after a flop is saved, so almost nothing is lost
    if in_window; then now=1; else now=0; fi
    if [ $now -ne $ALL ]; then
      # only worth waiting for a flop while it is actually solving (not queued for a slot, not paused)
      for _ in $(seq 60); do
        ps -o comm= -p $PID | grep -q hu-solver || break
        case $(ps -o state= -p $PID) in T*) break ;; esac
        [ $(( $(date +%s) - $(stat -f %m "$DIR/heartbeat" 2>/dev/null || echo 0) )) -lt 15 ] && break
        sleep 5
      done
      say "switching to $([ $now -eq 1 ] && echo every core || echo efficiency cores); restarting $PID"
      SWITCH=1; kill -9 $PID 2>/dev/null; break
    fi
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
  [ $SWITCH -eq 1 ] && continue
  if [ $code -eq 0 ] && tail -1 "$DIR/log.txt" | grep -q '^finished$'; then say "run finished"; exit 0; fi
  if [ $(( $(date +%s) - START )) -lt 120 ]; then QUICK=$((QUICK + 1)); else QUICK=0; fi
  if [ $QUICK -ge 5 ]; then say "hu-solver died within 2 minutes 5 times in a row; giving up (see $DIR/stdout.txt)"; exit 0; fi
  say "hu-solver exited with code $code; restarting in 30s"
  sleep 30
done
