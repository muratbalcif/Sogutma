# Android — Play Store release

Package: `com.furkansogutma.app`  
Flavor / type: **productionRelease**  
Artifact: AAB (not APK)

## One-time setup

### 1. Upload keystore

```bash
cd mobile
keytool -genkey -v \
  -keystore upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias upload
```

Copy `keystore.properties.example` → `keystore.properties` and set `storeFile`, passwords, and `keyAlias`.

**Back up** `.jks` + passwords offline. Never commit them (gitignored).

Play App Signing: upload the AAB; Google keeps the app signing key. You keep the **upload** key.

### 2. Firebase

Place `mobile/app/google-services.json` for packages:

- `com.furkansogutma.app` (production)
- `com.furkansogutma.app.dev` / `.staging` (optional)

### 3. Play Console

1. Create app → package `com.furkansogutma.app`
2. Store listing (TR): title, short/full description, screenshots, feature graphic, icon 512×512
3. Privacy policy URL (required if account/login/notifications)
4. Content rating questionnaire
5. Target audience / Data safety form
6. Enable **Play App Signing**

## Build signed AAB

```bash
bash scripts/android-release-aab.sh
# or:
cd mobile && ./gradlew :app:bundleProductionRelease
```

Output:

`mobile/app/build/outputs/bundle/productionRelease/app-production-release.aab`

## Versioning

| Field | Location | First release |
|-------|----------|---------------|
| `versionCode` | `app/build.gradle.kts` | `1` (must increase every Play upload) |
| `versionName` | same | `1.0.0` |

Bump `versionCode` (+1) before every new upload; bump `versionName` for user-facing releases.

## Release checklist

- [ ] Production API healthy: `https://api.furkansogutma.net/api/v1/health`
- [ ] `keystore.properties` + `upload-keystore.jks` present
- [ ] `google-services.json` present for production package
- [ ] `versionCode` / `versionName` bumped if re-upload
- [ ] AAB built with `scripts/android-release-aab.sh`
- [ ] Internal testing track first (recommended)
- [ ] Smoke: login, catalog, cart, checkout, orders, push (if FCM enabled)
- [ ] No secrets in logs / repo

## Security notes

- Release: R8 minify + shrink, network BODY logs off
- `allowBackup=false` + backup/data-extraction exclusions (tokens stay off cloud backup)
- Cleartext only for emulator `10.0.2.2` / `localhost` (dev); production uses HTTPS

## Do not

- Commit `*.jks`, `keystore.properties`, or `google-services.json`
- Upload a **debug** or **dev/staging** build to production
- Reuse a lost upload key without Play Console key reset process
