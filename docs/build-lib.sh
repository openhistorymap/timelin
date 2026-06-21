#!/usr/bin/env bash
# Regenerate docs/lib/ — the browser-ESM build of @openhistorymap/timeline-core
# that powers the live demo on the GitHub Pages docs site. The core has zero
# runtime dependencies, so this is just `tsc` + an extension fixup (browsers
# require explicit .js on relative ESM specifiers, which tsc leaves bare).
#
# Run from the repo root:  bash docs/build-lib.sh
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf docs/lib
npx tsc packages/core/src/index.ts packages/core/src/wikidata.ts packages/core/src/vis.ts \
  --outDir docs/lib --module es2020 --target es2019 --moduleResolution node \
  --lib ES2020,DOM,DOM.Iterable --skipLibCheck --removeComments

for f in docs/lib/*.js; do
  sed -i -E "s#(from ['\"]\\./[A-Za-z0-9_]+)(['\"])#\\1.js\\2#g" "$f"
done

echo "docs/lib regenerated."
