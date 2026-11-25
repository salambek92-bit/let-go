// The ONE place to swap ad IDs. These are Google's official TEST IDs.
// Real IDs: replace appId + interstitialUnitId with your AdMob IDs and set testMode: false.
// The appId is also written into the iOS Info.plist by native/scripts/apply-config.mjs.
export default {
  appId: 'ca-app-pub-3940256099942544~1458002511',          // AdMob App ID (iOS)
  interstitialUnitId: 'ca-app-pub-3940256099942544/4411468910', // Interstitial ad unit (iOS)
  testMode: true,
  everyNthGameOver: 3,
};
