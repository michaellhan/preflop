#!/usr/bin/env bash
# Publishes the app to https://www.michael-han.com/preflop/ by copying it into the
# michaellhan/michaellhan.github.io repo (folder: preflop/) and pushing.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
gh repo clone michaellhan/michaellhan.github.io "$WORK/site" -- -q --depth 1
rm -rf "$WORK/site/preflop"
mkdir -p "$WORK/site/preflop"
cp -R "$HERE/css" "$HERE/js" "$WORK/site/preflop/"
# Cloudflare caches .js/.css for hours, so tag them with the commit to make each deploy load fresh files.
VER="$(cd "$HERE" && git rev-parse --short HEAD)"
sed -E "s#(href|src)=\"((css|js)/[^\"]+)\"#\1=\"\2?v=$VER\"#g" "$HERE/index.html" > "$WORK/site/preflop/index.html"
# The charts get their own URL (/preflop/ranges/): a copy of the page whose relative paths
# resolve from the app root, with its own canonical URL. The old /preflop/about/ page now just redirects to the trainer.
mkdir -p "$WORK/site/preflop/ranges" "$WORK/site/preflop/about"
sed -e 's|<head>|<head><base href="../">|' -e 's|rel="canonical" href="https://www.michael-han.com/preflop/"|rel="canonical" href="https://www.michael-han.com/preflop/ranges/"|' \
  "$WORK/site/preflop/index.html" > "$WORK/site/preflop/ranges/index.html"
printf '<!DOCTYPE html><meta http-equiv="refresh" content="0; url=../"><link rel="canonical" href="../">\n' > "$WORK/site/preflop/about/index.html"
cd "$WORK/site"
git add -A
if git diff --cached --quiet; then echo "Site already up to date."; exit 0; fi
git commit -q -m "preflop: deploy $(cd "$HERE" && git rev-parse --short HEAD)"
git push -q origin main
echo "Deployed. GitHub Pages will update https://www.michael-han.com/preflop/ in about a minute."
