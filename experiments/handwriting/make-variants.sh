#!/bin/sh
# Rebuild the 4 test variants from page 2 of the owner's whiteboard PDF (not committed; owner has it).
# Usage: sh make-variants.sh /path/to/8dec8df123.pdf
pdftoppm -r 40 -f 2 -l 2 -png "$1" p && mv p-2.png v1-original.png
convert v1-original.png -fill '#4a90d9' -draw "rectangle 120 620 640 860" v2-opaque-shape-over.png
convert v1-original.png -fill 'rgba(255,220,0,0.45)' -draw "rectangle 60 500 700 900" v3-translucent-highlight-over.png
convert -size 2133x1200 xc:'#e6e6e6' -fill '#bfe3ff' -stroke '#1f5fa8' -strokewidth 6 -draw "roundrectangle 40 440 720 1150 40,40" bg.png
convert v1-original.png -fuzz 12% -transparent '#dcdcdc' fg.png && convert bg.png fg.png -compose Over -composite v4-writing-over-filled-shape.png
