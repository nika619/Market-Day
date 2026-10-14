#!/bin/bash
# local 4K renders of the three Market Day brands (30 fps), each followed by a pass that fills any frame Edge dropped
cd "$(dirname "$0")"
for s in market-set3 market market-set2; do
  rm -rf "m4k_$s"
  PAGE=preview-market.html node shots.js "$s" "m4k_$s" fps:30 6 3840
  PAGE=preview-market.html node fill.js "$s" "m4k_$s" 4 3840
  echo "$s frames: $(ls m4k_$s | wc -l)"
done
