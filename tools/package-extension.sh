#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VERSION=$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["version"])' "$ROOT/manifest.json")
OUTPUT=${1:-"$ROOT/dist/loot-captain-v$VERSION.zip"}

case "$OUTPUT" in
  /*) ;;
  *) OUTPUT="$ROOT/$OUTPUT" ;;
esac

mkdir -p "$(dirname -- "$OUTPUT")"
rm -f "$OUTPUT"

(cd "$ROOT" && zip -X -qr "$OUTPUT" background content icons options popup manifest.json)

echo "Created $OUTPUT"

# Keep only the newest two archives: the current release and one previous
# build to roll back to.
ls "$(dirname -- "$OUTPUT")"/loot-captain-v*.zip 2>/dev/null | sort -Vr | tail -n +3 |
  while IFS= read -r stale; do
    rm -f "$stale"
    echo "Removed $stale"
  done
