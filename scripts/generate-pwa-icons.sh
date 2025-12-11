#!/bin/bash
# Generate PWA icons using Node.js and sharp
# Run from project root: ./scripts/generate-pwa-icons.sh

set -e

cd "$(dirname "$0")/.."

echo "Generating PWA icons..."
npx tsx scripts/generate-pwa-icons.ts

echo "Done!"

