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
