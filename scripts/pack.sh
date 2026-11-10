#!/bin/sh
# Build dist/pocket-device-simulator-<version>.zip from mobile-sim/ (for "Load unpacked" after unzipping,
# or for upload to the Chrome Web Store).
set -e
cd "$(dirname "$0")/.."
VERSION=$(python3 -c "import json;print(json.load(open('mobile-sim/manifest.json'))['version'])")
for f in mobile-sim/*.js; do node --check "$f"; done
mkdir -p dist
OUT="dist/pocket-device-simulator-$VERSION.zip"
rm -f "$OUT"
(cd mobile-sim && zip -qr "../$OUT" . -x '.*' -x '*/.DS_Store' -x 'README.md')
echo "$OUT ($(du -h "$OUT" | cut -f1))"
