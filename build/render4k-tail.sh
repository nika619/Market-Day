#!/bin/bash
# re-render only 9.0-15.0 s (frames 270-449) of the local 4K renders; everything before 9 s is unchanged by the on-tray product
cd "$(dirname "$0")"
for s in market-set3 market market-set2; do
  mkdir -p "m4k_$s"
  for i in $(seq 270 449); do rm -f "m4k_$s/f_$(printf %04d $i).png"; done
  PAGE=preview-market.html node fill.js "$s" "m4k_$s" 5 3840
  echo "$s frames: $(ls m4k_$s | wc -l)"
done
