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
`--shift-from R` gives each round from R on its own flop sample (see `sample_flops_at`). `--correct-from R` corrects
each round's values from R on for which flops the sample drew (`src/correct.rs`): a hand's postflop value moves with
its equity on the flop, equity is computed exactly on all 1,755 flops (about a minute a pot, saved as
`round_N/eq_<pot>.txt`), and a fit of value on eq, eq² and eq³ over the sampled flops removes the part of the sample
average that comes from the sample's equity being off. The log shows each pot's mean change.
Raise `--rounds` to continue a finished run. Progress is in `runs/hu/log.txt`, and each round's strategy in
`runs/hu/strategy_N.txt`.

`node report.mjs [runDir] [--avg N]` checks the pass bar against PokerCoaching's heads-up chart and writes
`hu_charts.json`. With `--avg N` it uses the reach-weighted average of the last N rounds, which settles hands that
flip between rounds because they are close to indifferent. Average only rounds run with the same settings.

## Convergence: averaged values (2026-11-26)

Rounds 6-17 never converged. Each round's preflop solve (CFR+, exploitability about 0.00001bb after 16,000
iterations) answers that round's postflop values exactly, but those values swing round to round with the ranges
they were solved against (SB A5s limp +0.94bb against round 16's values, -0.05bb against round 17's), so the
near-indifferent hands flipped fully every round. With the strategy moved a fixed 60% toward each answer they
settled into a two-round cycle (0.71, 0.29, 0.71, ...), and the charts, the average of rounds 13-18, put about half
the SB's hands at an even raise/limp split. That was the cycle, not indifference.

`--avg-values-from R` fixes it: from round R on, the preflop solve uses the mean of every round's values since R
(each against the ranges that round was solved with) and the strategy takes the full step (`--late-alpha 1.0`).
That is fictitious play on the values: mixed hands come out of the preflop solve at the mix that makes their
actions equal in value. strategy_18.txt is the solve against the mean of rounds 12-17 (the cycle's strategy is kept
as strategy_18.cycle.txt, its charts as hu_charts.cycle.json); rounds 18 on re-solve postflop against it:

```bash
./run.sh --dir runs/hu --tree B --rounds 21 --late-alpha 1.0 --shift-from 11 --correct-from 12 --avg-values-from 12
```

## Audit

`./target/release/hu-solver --dir runs/hu --tree B --shift-from 11 --correct-from 12 --iters 16000 --audit A-B --out F.json`
solves the preflop tree against the mean of rounds A-B's saved values (nothing new is solved; `--save P` also writes
the strategy) and exports every node's raw probabilities, each action's value per combo (bb, given the hand reaches
the node), the cumulative CFR+ regrets, each hand's own reach and the opponent mass it meets there (the
full-width solve has no sampled visit counts; reach is the equivalent), and the solve's exploitability at 50 to
16,000 iterations. `python3 audit_report.py F.json ...` prints the convergence, the SB's 50/50 count, the mixed
hands' value gaps (they should be near zero) and the flagged hands' action values. `apply_charts.mjs` writes
report.mjs's hu_charts.json into js/ranges.js.

Exploitability in the log is now each player's best-response gain over their value playing the strategy, added;
before, it was the two best-response values added, which rake pulled below zero (round 6's -0.051).

Limits: 169 hand classes preflop, one bet size per street, raises on the flop only, and postflop values held fixed
within a round. The output is the equilibrium of that simplified game, not of real poker.

## Cross-checks from the other poker projects (read only)

- `lizard_hu.py` solves this exact game (sizes, rake, limps) in Lizard's class-level preflop model, whose flop values
  are fitted to published 6-max solves rather than solved. `report.mjs` compares against it when
  `runs/lizard_hu/strategy.txt` exists. Run with `~/Desktop/projects/lizard/.venv/bin/python lizard_hu.py` (1 second).
- `flop_sample_error.py` measures how far a 50-flop sample is from all 1,755 flops, on gtosolver's heads-up
  single-raised library (`gtosolver/.work/hu-lib`, every flop solved, 3bb open). On 2026-11-12: the fixed sample was off
  by 0.22bb per hand class on average (worst 1.1bb, in a 6bb pot), one shifted sample by 0.25, and the 6 shifted
  samples together by 0.08 (worst 0.41). That error flips hands that are close to indifferent, such as T7o over T8o.
  It then runs `target/release/sample_check` on the library, which applies the solver's own correction code and
  compares it with the truth (2026-11-13, mass-weighted as in the solver): one 50-flop sample's error falls from 0.18bb
  per class to 0.06 (worst 1.35 to 0.27), on 20 shifted samples it was not tuned on as well, and the 6 shifted samples
  together from 0.053 to 0.014 (worst 0.07). The fit uses the sampled flops only; the library is only the referee.
