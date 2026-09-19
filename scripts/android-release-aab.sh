#!/usr/bin/env bash
# Build a signed Play Store AAB: productionRelease.
# Requires mobile/keystore.properties + storeFile (see keystore.properties.example).
# Never prints passwords or keystore contents.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/mobile"
cd "$MOBILE"

die() { echo "ERROR: $*" >&2; exit 1; }

[[ -f keystore.properties ]] || die "Missing keystore.properties — copy keystore.properties.example and fill storeFile/passwords."
[[ -f app/google-services.json ]] || die "Missing app/google-services.json (Firebase; gitignored)."

STORE_FILE="$(grep -E '^storeFile=' keystore.properties | cut -d= -f2- | tr -d '\r')"
[[ -n "$STORE_FILE" ]] || die "keystore.properties missing storeFile"
[[ -f "$STORE_FILE" ]] || die "Keystore file not found: $STORE_FILE (path relative to mobile/)"

echo "Building signed productionRelease AAB…"
./gradlew :app:bundleProductionRelease --quiet

AAB="app/build/outputs/bundle/productionRelease/app-production-release.aab"
[[ -f "$AAB" ]] || die "AAB not found at $AAB"

echo "OK: $MOBILE/$AAB"
echo "Upload this file in Play Console → Production (or Internal testing)."
