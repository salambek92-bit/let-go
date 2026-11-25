#!/usr/bin/env python3
"""App Store Connect helper for Jungle Drop (runs in CI with the ASC API key from env; never prints secrets).
  check  -> writes exists=true/false to $GITHUB_OUTPUT (is there an app record for the bundle id?)
  apply  -> fills metadata, category, age rating and screenshots for the editable version.
It NEVER creates a review submission."""
import hashlib, json, os, sys, time, urllib.request, urllib.error
import jwt  # PyJWT, installed with codemagic-cli-tools

HERE = os.path.dirname(os.path.abspath(__file__))
STORE = os.path.join(HERE, '..', 'store')
META = json.load(open(os.path.join(STORE, 'metadata.json')))
API = 'https://api.appstoreconnect.apple.com'

def token():
    now = int(time.time())
    return jwt.encode({'iss': os.environ['APP_STORE_CONNECT_ISSUER_ID'], 'iat': now, 'exp': now + 1100, 'aud': 'appstoreconnect-v1'},
                      os.environ['APP_STORE_CONNECT_PRIVATE_KEY'], algorithm='ES256',
                      headers={'kid': os.environ['APP_STORE_CONNECT_KEY_IDENTIFIER'], 'typ': 'JWT'})

def call(method, path, body=None, ok_missing=False):
    url = path if path.startswith('http') else API + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        msg = e.read().decode(errors='replace')[:800]
        if ok_missing and e.code == 404: return None
        raise RuntimeError(f'{method} {path} -> {e.code}: {msg}')

def step(name, fn):
    try:
        fn(); print(f'OK   {name}')
    except Exception as e:  # keep going; report at the end
        print(f'::warning::{name} failed: {e}'); FAILED.append(name)
FAILED = []

def app_id():
    r = call('GET', f"/v1/apps?filter[bundleId]={META['bundleId']}&limit=1")
    return r['data'][0]['id'] if r.get('data') else None

def check():
    aid = app_id()
    print('App record for', META['bundleId'], 'exists' if aid else 'MISSING')
    out = os.environ.get('GITHUB_OUTPUT')
    if out:
        with open(out, 'a') as f: f.write(f"exists={'true' if aid else 'false'}\n")

def apply():
    aid = app_id()
    if not aid: print('::error::No app record yet'); sys.exit(1)
    loc = META['locale']

    # --- App info (name, subtitle, privacy URL, categories) ---
    infos = call('GET', f'/v1/apps/{aid}/appInfos')['data']
    info = next((i for i in infos if i['attributes'].get('appStoreState') not in ('READY_FOR_SALE', 'REPLACED_WITH_NEW_VERSION')), infos[0])
    iid = info['id']
    def app_info_loc():
        locs = call('GET', f'/v1/appInfos/{iid}/appInfoLocalizations')['data']
        attrs = {'name': META['name'], 'subtitle': META['subtitle'], 'privacyPolicyUrl': META['privacyPolicyUrl']}
        mine = next((l for l in locs if l['attributes']['locale'] == loc), None)
        if mine: call('PATCH', f"/v1/appInfoLocalizations/{mine['id']}", {'data': {'type': 'appInfoLocalizations', 'id': mine['id'], 'attributes': attrs}})
        else: call('POST', '/v1/appInfoLocalizations', {'data': {'type': 'appInfoLocalizations', 'attributes': {'locale': loc, **attrs}, 'relationships': {'appInfo': {'data': {'type': 'appInfos', 'id': iid}}}}})
    step('name/subtitle/privacy URL', app_info_loc)
    def categories():
        rel = {k: {'data': {'type': 'appCategories', 'id': META[k]}} for k in ('primaryCategory', 'primarySubcategoryOne', 'primarySubcategoryTwo', 'secondaryCategory') if META.get(k)}
        call('PATCH', f'/v1/appInfos/{iid}', {'data': {'type': 'appInfos', 'id': iid, 'relationships': rel}})
    step('categories', categories)
    def age():
        r = call('GET', f'/v1/appInfos/{iid}/ageRatingDeclaration')['data']
        attrs = dict(META['ageRating'])
        try:
            call('PATCH', f"/v1/ageRatingDeclarations/{r['id']}", {'data': {'type': 'ageRatingDeclarations', 'id': r['id'], 'attributes': attrs}})
        except RuntimeError as e:  # older/newer schema: retry with only the fields Apple returned
            known = set(r.get('attributes', {}).keys())
            attrs = {k: v for k, v in attrs.items() if k in known}
            call('PATCH', f"/v1/ageRatingDeclarations/{r['id']}", {'data': {'type': 'ageRatingDeclarations', 'id': r['id'], 'attributes': attrs}})
    step('age rating', age)
    step('content rights', lambda: call('PATCH', f'/v1/apps/{aid}', {'data': {'type': 'apps', 'id': aid, 'attributes': {'contentRightsDeclaration': META['contentRightsDeclaration']}}}))

    # --- Version (description, keywords, promo, URLs, copyright) ---
    vers = call('GET', f'/v1/apps/{aid}/appStoreVersions?filter[platform]=IOS&limit=10')['data']
    ver = next((v for v in vers if v['attributes']['appStoreState'] in ('PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED')), None)
    if not ver:
        ver = call('POST', '/v1/appStoreVersions', {'data': {'type': 'appStoreVersions', 'attributes': {'platform': 'IOS', 'versionString': os.environ.get('APP_VERSION', '1.0')}, 'relationships': {'app': {'data': {'type': 'apps', 'id': aid}}}}})['data']
    vid = ver['id']
    step('copyright', lambda: call('PATCH', f'/v1/appStoreVersions/{vid}', {'data': {'type': 'appStoreVersions', 'id': vid, 'attributes': {'copyright': META['copyright']}}}))
    vlocs = call('GET', f'/v1/appStoreVersions/{vid}/appStoreVersionLocalizations')['data']
    vloc = next((l for l in vlocs if l['attributes']['locale'] == loc), None)
    vattrs = {k: META[k] for k in ('description', 'keywords', 'promotionalText', 'supportUrl', 'marketingUrl')}
    def version_loc():
        nonlocal vloc
        if vloc: call('PATCH', f"/v1/appStoreVersionLocalizations/{vloc['id']}", {'data': {'type': 'appStoreVersionLocalizations', 'id': vloc['id'], 'attributes': vattrs}})
        else: vloc = call('POST', '/v1/appStoreVersionLocalizations', {'data': {'type': 'appStoreVersionLocalizations', 'attributes': {'locale': loc, **vattrs}, 'relationships': {'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': vid}}}}})['data']
    step('description/keywords/promo/URLs', version_loc)
    def review_info():
        r = call('GET', f'/v1/appStoreVersions/{vid}/appStoreReviewDetail', ok_missing=True)
        attrs = {'notes': META['reviewNotes'], 'demoAccountRequired': False}
        if r and r.get('data'): call('PATCH', f"/v1/appStoreReviewDetails/{r['data']['id']}", {'data': {'type': 'appStoreReviewDetails', 'id': r['data']['id'], 'attributes': attrs}})
        else: call('POST', '/v1/appStoreReviewDetails', {'data': {'type': 'appStoreReviewDetails', 'attributes': attrs, 'relationships': {'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': vid}}}}})
    step('review notes', review_info)

    # --- Screenshots ---
    def screenshots():
        if not vloc: raise RuntimeError('no version localization')
        sets = call('GET', f"/v1/appStoreVersionLocalizations/{vloc['id']}/appScreenshotSets")['data']
        for dtype, files in META['screenshots'].items():
            s = next((x for x in sets if x['attributes']['screenshotDisplayType'] == dtype), None)
            if s:  # replace what is there
                for old in call('GET', f"/v1/appScreenshotSets/{s['id']}/appScreenshots")['data']: call('DELETE', f"/v1/appScreenshots/{old['id']}")
            else:
                s = call('POST', '/v1/appScreenshotSets', {'data': {'type': 'appScreenshotSets', 'attributes': {'screenshotDisplayType': dtype}, 'relationships': {'appStoreVersionLocalization': {'data': {'type': 'appStoreVersionLocalizations', 'id': vloc['id']}}}}})['data']
            for fn in files:
                blob = open(os.path.join(STORE, 'screenshots', fn), 'rb').read()
                shot = call('POST', '/v1/appScreenshots', {'data': {'type': 'appScreenshots', 'attributes': {'fileName': fn, 'fileSize': len(blob)}, 'relationships': {'appScreenshotSet': {'data': {'type': 'appScreenshotSets', 'id': s['id']}}}}})['data']
                for op in shot['attributes']['uploadOperations']:
                    part = blob[op['offset']:op['offset'] + op['length']]
                    req = urllib.request.Request(op['url'], data=part, method=op['method'], headers={h['name']: h['value'] for h in op.get('requestHeaders', [])})
                    urllib.request.urlopen(req, timeout=120).read()
                call('PATCH', f"/v1/appScreenshots/{shot['id']}", {'data': {'type': 'appScreenshots', 'id': shot['id'], 'attributes': {'uploaded': True, 'sourceFileChecksum': hashlib.md5(blob).hexdigest()}}})
                print('  uploaded', dtype, fn)
    step('screenshots', screenshots)

    print('\nDone. Nothing was submitted for review.')
    if FAILED: print('::warning::Needs a manual look in App Store Connect: ' + ', '.join(FAILED))

if __name__ == '__main__':
    {'check': check, 'apply': apply}[sys.argv[1]]()
