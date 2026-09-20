# Preflop Lab

A GTO Wizard-style **preflop trainer** for 100bb cash games. Static site, no build step.

Live at **https://www.michael-han.com/preflop/**

- **Trainer** — random spot (open / facing an open / facing a 3-bet / BB vs SB limp) at 6-max, 9-max or heads-up, you pick fold / call / raise, and get graded against the equilibrium frequencies with the full range revealed, an estimated **EV loss** in bb, and a **"why" note** explaining the decision (hand class, position, villain's range, the pattern it belongs to).
- **Range Charts** — 13x13 reference charts for every position and scenario, split by action frequency.
- **About the Data** — game model, sizes, accuracy notes and scoring rules.

## Run

Open `index.html` in a browser, or serve the folder:

```bash
node scripts/serve.mjs 8791
```

## Check the EV model

```bash
node scripts/calibrate-ev.mjs 400
```

Prints model EVs for known cases and how often the model's best action matches GTO's pure actions.

## Deploy

```bash
scripts/deploy.sh
```

Copies `index.html`, `css/` and `js/` into the `preflop/` folder of the personal-site repo and pushes; GitHub Pages serves it at michael-han.com/preflop.

## Validate the range data

```bash
node scripts/validate.mjs
```

Parses every range, fails on duplicate hands or frequencies over 100%, and prints the action percentages for every spot.

## Files

- `js/ranges.js` — all range data in compact notation (`A5s:0.6` = 60% frequency).
- `js/hands.js` — hand grid and range-notation parser.
- `js/spots.js` — builds the trainable spots (action history, sizes, 9-max mapping).
- `js/equity.js` — 7-card evaluator and Monte Carlo hand-vs-range equity.
- `js/ev.js` — approximate preflop EV model (fold equity + equity realization) used for EV loss.
- `js/explain.js` — rule-based "why" notes.
- `js/table.js`, `js/grid.js`, `js/app.js` — UI.
