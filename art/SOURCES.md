# Art sources

All pixel art in `mobile-sim/assets/` was generated with MaxPlus (`gpt-image-2.5-flare`) on 2026-11-10,
using only our own UI screenshot (`art/refs/ui-toolbar-ref.png`) and our own earlier samples as references.
Raw files: `art/maxplus/raw/2026-11-10/` (one line each in `art/maxplus/manifest.jsonl`).

Processing: `python3 art/pixelize.py RAW OUT GRID` cuts out the magenta background, snaps the image to a
pixel grid and locks it to the 4-colour palette. Thumbnails use GRID 40, mascots 48, the scene 320.
Extension icons (`mobile-sim/icons/48.png`, `128.png`) are the mascot at 1x/2x; `16.png` is hand-drawn.
Cost: 14 images x 0.625 = 8.75 credits.
