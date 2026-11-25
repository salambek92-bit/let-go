#!/usr/bin/env bash
# Runs on the GitHub macOS runner with the App Store Connect API key from env (never printed).
# Same route as Favora: registers the Bundle ID if missing, creates/reuses the Apple Distribution
# certificate for CERTIFICATE_PRIVATE_KEY and an App Store profile, installs them in a temp keychain.
set -euo pipefail
: "${BUNDLE_ID:=no.samm.letgo}"
if [ -z "${CERTIFICATE_PRIVATE_KEY:-}" ]; then echo "::error::Secret CERTIFICATE_PRIVATE_KEY is missing"; exit 1; fi
id_of() { app-store-connect bundle-ids list --bundle-id-identifier "$BUNDLE_ID" --strict-match-identifier --platform IOS --json 2>/dev/null | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d[0]["id"] if d else "")'; }
BID="$(id_of || true)"
if [ -z "$BID" ]; then
  echo "Registering Bundle ID $BUNDLE_ID"
  app-store-connect bundle-ids create "$BUNDLE_ID" --name "Jungle Drop" --platform IOS
  BID="$(id_of)"
fi
echo "Bundle ID resource: $BID"
keychain initialize
app-store-connect fetch-signing-files "$BUNDLE_ID" --platform IOS --type IOS_APP_STORE --strict-match-identifier --create --delete-stale-profiles
keychain add-certificates
