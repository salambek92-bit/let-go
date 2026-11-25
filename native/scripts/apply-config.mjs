// Patches the iOS project after `cap sync`: ads App ID (from ../src/ads-config.js), ATT text, SKAdNetwork list,
// portrait-only, full-screen, hidden status bar, iPhone-only, no export-compliance prompt, app icon.
import fs from 'node:fs';
import ADS from '../../src/ads-config.js';
const plistPath = 'ios/App/App/Info.plist';
let p = fs.readFileSync(plistPath, 'utf8');
const SKAN = 'cstr6suwn9 4fzdc2evr5 2fnua5tdw4 ydx93a7ass p78axxw29g v72qych5uu ludvb6z3bs cp8zw746q7 3sh42y64q3 c6k4g5qg8m s39g8k73mm wg4vff78zm 3qy4746246 f38h382jlk hs6bdukanm mlmmfzh3r3 v4nxqhlyqp wzmmz9fp6w su67r6k2v3 yclnxrl5pm t38b2kh725 7ug5zh24hu gta9lk7p23 vutu7akeur y5ghdn5j9k v9wttpbfk9 n38lu8286q 47vhws6wlr kbd757ywx3 9t245vhmpl a2p9lx4jpn 22mmun2rn5 44jx6755aq k674qkevps 4468km3ulz 2u9pt9hc89 8s468mfl3y klf5c3l5u5 ppxm28t8ap kbmxgpxpgc uw77j35x4d 578prtvx9j 4dzt52r2t5 tl55sbb4fm c3frkrj4fj e5fvkxwrpn 8c4e2ghe7u 3rd42ekr43 97r2b46745 3qcr597p9d'.split(' ');
const del = (key) => { p = p.replace(new RegExp(`\\s*<key>${key}</key>\\s*(<string>[^<]*</string>|<true/>|<false/>|<array>[\\s\\S]*?</array>)`), ''); };
for (const k of ['GADApplicationIdentifier', 'NSUserTrackingUsageDescription', 'SKAdNetworkItems', 'UISupportedInterfaceOrientations', 'UISupportedInterfaceOrientations~ipad', 'UIRequiresFullScreen', 'UIStatusBarHidden', 'UIViewControllerBasedStatusBarAppearance', 'ITSAppUsesNonExemptEncryption', 'UIRequiredDeviceCapabilities']) del(k);
const add = `
	<key>GADApplicationIdentifier</key>
	<string>${ADS.appId}</string>
	<key>NSUserTrackingUsageDescription</key>
	<string>Your choice is used only to show you more relevant ads between games. Let Go itself collects no data.</string>
	<key>SKAdNetworkItems</key>
	<array>
${SKAN.map((s) => `		<dict><key>SKAdNetworkIdentifier</key><string>${s}.skadnetwork</string></dict>`).join('\n')}
	</array>
	<key>UISupportedInterfaceOrientations</key>
	<array><string>UIInterfaceOrientationPortrait</string></array>
	<key>UIRequiresFullScreen</key>
	<true/>
	<key>UIStatusBarHidden</key>
	<true/>
	<key>UIViewControllerBasedStatusBarAppearance</key>
	<false/>
	<key>UIRequiredDeviceCapabilities</key>
	<array><string>arm64</string></array>
	<key>ITSAppUsesNonExemptEncryption</key>
	<false/>
</dict>
</plist>`;
p = p.replace(/<\/dict>\s*<\/plist>\s*$/, add + '\n');
fs.writeFileSync(plistPath, p);

const pbx = 'ios/App/App.xcodeproj/project.pbxproj';
let x = fs.readFileSync(pbx, 'utf8').replace(/TARGETED_DEVICE_FAMILY = "1,2";/g, 'TARGETED_DEVICE_FAMILY = 1;');
fs.writeFileSync(pbx, x);
if (fs.existsSync('assets/icon-1024.png')) fs.copyFileSync('assets/icon-1024.png', 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
for (const f of ['splash-2732x2732.png','splash-2732x2732-1.png','splash-2732x2732-2.png']) if (fs.existsSync('assets/splash-2732.png')) fs.copyFileSync('assets/splash-2732.png', 'ios/App/App/Assets.xcassets/Splash.imageset/' + f);
console.log('iOS config applied. AdMob App ID:', ADS.appId, ADS.testMode ? '(Google TEST ID)' : '(LIVE)');
