// Native bridge for the iOS app (Capacitor). On the web every call is a safe no-op.
// Ads: one interstitial after every 3rd game over, shown only on the game-over screen.
import ADS from './ads-config.js';

const Cap = window.Capacitor;
export const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
const P = (name) => (isNative && Cap.Plugins && Cap.Plugins[name]) || null;
export const PUBLIC_URL = 'https://salambek92-bit.github.io/let-go/';

// ---------- haptics ----------
export function haptic(kind) {
  const h = P('Haptics');
  try {
    if (h) {
      if (kind === 'grab') h.impact({ style: 'LIGHT' });
      else if (kind === 'release') h.selectionChanged ? h.selectionChanged() : h.impact({ style: 'LIGHT' });
      else if (kind === 'snap') h.impact({ style: 'MEDIUM' });
      else if (kind === 'dead') h.notification({ type: 'ERROR' });
      else if (kind === 'best') h.notification({ type: 'SUCCESS' });
    } else if (kind === 'dead' && navigator.vibrate) navigator.vibrate(60);
  } catch (_) {}
}

// ---------- share (native share sheet only) ----------
export async function nativeShare(text, blob) {
  const s = P('Share'); if (!s) return false;
  try {
    let files;
    const fs = P('Filesystem');
    if (blob && fs) {
      const data = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
      const w = await fs.writeFile({ path: 'jungle-drop.png', data, directory: 'CACHE' });
      files = [w.uri];
    }
    await s.share(files ? { text, files } : { text, url: PUBLIC_URL });
  } catch (_) {}
  return true;
}

// ---------- startup: status bar, splash ----------
export function boot() {
  if (!isNative) return;
  try { P('StatusBar')?.setStyle({ style: 'DARK' }); P('StatusBar')?.hide(); } catch (_) {}
  try { setTimeout(() => P('SplashScreen')?.hide({ fadeOutDuration: 250 }), 150); } catch (_) {}
  initAds();
}

// ---------- ads ----------
let adsReady = false, loaded = false, loading = false, showing = false, gamesOver = 0, pending = false;
async function initAds() {
  const ad = P('AdMob'); if (!ad) return;
  try {
    // 1) Google UMP consent (GDPR, needed in Norway/EEA)
    let info = await ad.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === 'REQUIRED') info = await ad.showConsentForm();
    // 2) Apple App Tracking Transparency prompt (if UMP did not already show it)
    try { const t = await ad.trackingAuthorizationStatus(); if (t.status === 'notDetermined') await ad.requestTrackingAuthorization(); } catch (_) {}
    if (info && info.canRequestAds === false) return;
    await ad.initialize({});
    adsReady = true;
    ad.addListener('interstitialAdLoaded', () => { loaded = true; loading = false; });
    ad.addListener('interstitialAdFailedToLoad', () => { loaded = false; loading = false; setTimeout(load, 30000); });
    preload();
  } catch (_) {}
}
function load() {
  const ad = P('AdMob'); if (!ad || !adsReady || loaded || loading) return;
  loading = true;
  ad.prepareInterstitial({ adId: ADS.interstitialUnitId, isTesting: !!ADS.testMode }).then(() => { loaded = true; loading = false; }).catch(() => { loading = false; });
}
function preload() { load(); }

// Call once per game over. Returns nothing; marks an ad as due every Nth game.
export function noteGameOver() {
  gamesOver++;
  if (gamesOver % (ADS.everyNthGameOver || 3) === 0) pending = true;
  if (pending) preload();
}
// Called from the game-over screen. Resolves when it is safe to continue (ad closed, or no ad).
export function adDue() { return isNative && adsReady && pending && loaded && !showing; }
export function isShowingAd() { return showing; }
export function showDueAd() {
  const ad = P('AdMob');
  if (!adDue() || !ad) return Promise.resolve(false);
  showing = true; pending = false; loaded = false;
  return new Promise((done) => {
    let finished = false; const hs = [];
    const end = () => { if (finished) return; finished = true; showing = false; hs.forEach((h) => h && h.remove && h.remove()); setTimeout(preload, 500); done(true); };
    Promise.resolve(ad.addListener('interstitialAdDismissed', end)).then((h) => hs.push(h));
    Promise.resolve(ad.addListener('interstitialAdFailedToShow', end)).then((h) => hs.push(h));
    ad.showInterstitial().catch(end);
    setTimeout(end, 120000); // never get stuck
  });
}
