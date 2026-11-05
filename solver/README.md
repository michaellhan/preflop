# Heads-up solver

Solves the 100bb heads-up preflop game with the site's bet sizes and rake (`js/ranges.js`). Each round solves the
postflop game of all six preflop pots on sampled flops with [postflop-solver](https://github.com/b-inary/postflop-solver)
(AGPL-3.0), solves the preflop tree against those hand values, and moves the strategy part of the way there.
Not deployed: `scripts/deploy.sh` only copies `css/`, `js/` and `index.html`.

```bash
node export_start.mjs
cargo build --release
SOLVER_WINDOW=23-8 caffeinate -i nice -n 5 ./target/release/hu-solver --dir runs/hu --tree B
```

`SOLVER_WINDOW` limits solving to those hours. Every finished flop is saved, so running the same command again resumes.
Raise `--rounds` to continue a finished run. Progress is in `runs/hu/log.txt`, and each round's strategy in
`runs/hu/strategy_N.txt`.

Limits: 169 hand classes preflop, one bet size per street, raises on the flop only, and postflop values held fixed
within a round. The output is the equilibrium of that simplified game, not of real poker.
