#!/usr/bin/env bash
# Publishes the app to https://www.michael-han.com/preflop/ by copying it into the
# michaellhan/michaellhan.github.io repo (folder: preflop/) and pushing.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
gh repo clone michaellhan/michaellhan.github.io "$WORK/site" -- -q --depth 1
rm -rf "$WORK/site/preflop"
mkdir -p "$WORK/site/preflop"
cp -R "$HERE/index.html" "$HERE/css" "$HERE/js" "$WORK/site/preflop/"
cd "$WORK/site"
git add -A
if git diff --cached --quiet; then echo "Site already up to date."; exit 0; fi
git commit -q -m "preflop: deploy $(cd "$HERE" && git rev-parse --short HEAD)"
git push -q origin main
echo "Deployed. GitHub Pages will update https://www.michael-han.com/preflop/ in about a minute."
