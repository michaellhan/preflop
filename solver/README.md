# Heads-up solver

Solves the 100bb heads-up preflop game with the site's bet sizes and rake (`js/ranges.js`). Each round solves the
postflop game of all six preflop pots on sampled flops with [postflop-solver](https://github.com/b-inary/postflop-solver)
(AGPL-3.0), solves the preflop tree against those hand values, and moves the strategy part of the way there.
Not deployed: `scripts/deploy.sh` only copies `css/`, `js/` and `index.html`.

```bash
node export_start.mjs
cargo build --release
SOLVER_WINDOW=23-8 caffeinate -i heavy ./target/release/hu-solver --dir runs/hu --tree B
```

`heavy` (`~/.mem-guard/heavy.py`, the Mac's CPU budget) runs the solver on the efficiency cores at nice 10, with rayon
at `RAYON_NUM_THREADS` (default 6), in one of the machine's two heavy slots, so tests and the UI keep the performance
cores. It runs slowly while other work fills the efficiency cores; `heavy -a` lets it use every core.

`SOLVER_WINDOW` limits solving to those hours. The solver also pauses while the Mac is on battery (`SOLVER_AC_ONLY=0`
turns that off). Every finished flop is flushed to disk before it counts, a damaged flop file is solved again, and
running the same command again resumes, so a crash or power cut loses at most the flop in progress.

`./run.sh [solver args]` (default: the current heads-up run) keeps it going. It restarts the solver after a crash,
kills and restarts it when `runs/hu/heartbeat` goes 20 minutes without an update, and exits once the run is finished.
It starts the solver through `heavy -x` when that is installed (`HEAVY_OPTS=-a` for every core), and doesn't count
time spent waiting for a heavy slot or paused (by `calm` during a test run, or by the memory guard) as a stall.
Its log is `runs/hu/supervisor.txt`. With `ALLCORE_WINDOW=22-8` it uses every core from 22:00 to 08:00 and the
efficiency cores (through `heavy`) otherwise, switching right after a flop finishes. To have it come back after a reboot as well, install `hu-solver.plist` as a
launchd agent (the commands are in the file).
Raise `--rounds` to continue a finished run. Progress is in `runs/hu/log.txt`, and each round's strategy in
`runs/hu/strategy_N.txt`.

`node report.mjs [runDir] [--avg N]` checks the pass bar against PokerCoaching's heads-up chart and writes
`hu_charts.json`. With `--avg N` it uses the reach-weighted average of the last N rounds, which settles hands that
flip between rounds because they are close to indifferent. Average only rounds run with the same settings.

Limits: 169 hand classes preflop, one bet size per street, raises on the flop only, and postflop values held fixed
within a round. The output is the equilibrium of that simplified game, not of real poker.
