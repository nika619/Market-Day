#!/bin/bash
# 4K transparent frames of titles.html for every 30 fps frame where a title is on screen; retries frames headless Edge drops
cd "$(dirname "$0")"
T=$(python -c "
W=[(0,2800),(3300,5700),(18000,24500),(25100,27500),(31600,34000),(37800,42300)]
print(','.join(str(round(i*1000/30)) for i in range(1269) if any(a<=round(i*1000/30)<b for a,b in W)))")
for pass in 1 2 3 4 5; do
  miss=$(python -c "
import os,sys; print(','.join(t for t in sys.argv[1].split(',') if not os.path.exists('tt4k/t_%05d.png'%int(t))))" "$T")
  [ -z "$miss" ] && break
  echo "pass $pass: $(echo $miss | tr ',' '\n' | wc -l) to render"
  TRANSPARENT=1 PAGE=titles.html node shots.js titles tt4k "$miss" 5 3840
done
echo "titles frames: $(ls tt4k | wc -l)"
