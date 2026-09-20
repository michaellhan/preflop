# Preflop Lab

A GTO Wizard-style **preflop trainer** for 100bb cash games. Static site, no build step.

- **Trainer** — random spot (open / facing an open / facing a 3-bet / BB vs SB limp) at 6-max or 9-max, you pick fold / call / raise, and get graded against the equilibrium frequencies with the full range revealed.
- **Range Charts** — 13x13 reference charts for every position and scenario, split by action frequency.
- **About the Data** — game model, sizes, accuracy notes and scoring rules.

## Run

Open `index.html` in a browser, or serve the folder:

```bash
node scripts/serve.mjs 8791
```

## Validate the range data

```bash
node scripts/validate.mjs
```

Parses every range, fails on duplicate hands or frequencies over 100%, and prints the action percentages for every spot.

## Files

- `js/ranges.js` — all range data in compact notation (`A5s:0.6` = 60% frequency).
- `js/hands.js` — hand grid and range-notation parser.
- `js/spots.js` — builds the trainable spots (action history, sizes, 9-max mapping).
- `js/table.js`, `js/grid.js`, `js/app.js` — UI.
