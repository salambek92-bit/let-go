# Jungle Drop — iOS app (Capacitor)

- Bundle ID `no.samm.letgo`, display name **Jungle Drop**. iPhone only, portrait, full screen, status bar hidden.
- The game (`../src`) is copied into `www/` and bundled in the app, so it runs fully offline. No remote URL is loaded.
- Native: haptics (grab, release, snap, fall, new best), native share sheet for the score card, local best score.
- Ads: Google AdMob interstitial after every 3rd game over, shown only on the game-over screen (never mid-swing),
  via `@capacitor-community/admob`. Google UMP consent (EEA) + Apple ATT prompt at launch, SKAdNetwork list in Info.plist.

## Swap to real AdMob IDs (one place)
Edit `../src/ads-config.js`: `appId`, `interstitialUnitId`, and set `testMode: false`. `npm run sync` writes the App ID into Info.plist.

## Build
`npm ci && npm run sync` (copy web → cap sync → patch Info.plist/icon/splash).
Cloud build + upload: GitHub Actions workflow **Let Go iOS** in `salambek92-bit/favora` (reuses that repo's App Store Connect API key secrets).
It registers the bundle ID, signs, builds the IPA, and if the App Store Connect app record exists, uploads it and fills metadata + screenshots
from `store/`. It never submits for review.

## Store files
`store/metadata.json` (name, subtitle, description, keywords, promo, age rating, URLs), `store/screenshots/` (6.7" 1290×2796, 6.5" 1242×2688), `assets/icon-1024.png`.
