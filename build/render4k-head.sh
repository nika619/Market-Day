#!/bin/bash
# re-render only 0.0-1.5 s (frames 0-44) of the local 4K renders after the opening fade-in was removed
cd "$(dirname "$0")"
for s in market-set3 market market-set2; do
  for i in $(seq 0 44); do rm -f "m4k_$s/f_$(printf %04d $i).png"; done
  PAGE=preview-market.html node fill.js "$s" "m4k_$s" 5 3840
  echo "$s frames: $(ls m4k_$s | wc -l)"
done
