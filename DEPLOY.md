# Dicestorm — Play Store deploy guide

App id: **com.dicestorm.app** · current version: **1.0.0 (versionCode 1)**

## One-time setup you must do (account-bound, can't be scripted)

1. **Google Play Developer account** — register at <https://play.google.com/console>
   (one-time US$25). Required to publish anything.
2. **Create the app** in Play Console → *Create app* → name "Dicestorm", type App, Free.
3. **In-app product (the tip)** — Play Console → *Monetize → Products → In-app products*
   → *Create product*:
   - Product ID: **`dicestorm_tip`**  ← must match `TIP_PRODUCT_ID` in `app.js`
   - Type: leave default (managed); the app treats it as **consumable** so it can be
     bought repeatedly.
   - Name/description: e.g. "Leave a tip", set price (~US$2.99). Activate it.
   - To test billing before going live, add your Google account under
     *Setup → License testing*.
4. **Privacy policy URL** — Play requires one. Use the hosted page:
   `https://buchiboom.github.io/wardice/privacy.html`
   (paste under *App content → Privacy policy*).
5. **Data safety form** — declare: *no data collected, no data shared*. Purchases are
   handled by Google Play.
6. **Content rating** questionnaire — it's a dice utility, no objectionable content.

## Build the upload artifact

Run **`build-aab.bat`** from the project root. Output:

    android\app\build\outputs\bundle\release\app-release.aab

Upload that .aab to Play Console → *Production* (or *Internal testing* first).

## Signing

- The release is signed with the **upload key** in `android/dicestorm-upload.jks`,
  configured via `android/keystore.properties` (both are git-ignored).
- **Back up `dicestorm-upload.jks` + `keystore.properties` somewhere safe.**
- Keep **Play App Signing** enabled (default) when you create the app — Google then
  holds the real app-signing key, and your upload key is resettable if ever lost.

## Updating later

Bump `versionCode` (and `versionName`) in `android/app/build.gradle`, bump
`APP_VERSION` in `app.js` + the `CACHE` string in `sw.js`, then rebuild the .aab.

## Notes

- In-app purchases only work in a build installed **from Play** (internal testing track
  or production) with a real signed bundle and an active product — they do nothing in the
  debug APK or the web/PWA build, where the SUPPORT section stays hidden.
- The web PWA (GitHub Pages) and the Play app share the same code; only billing and
  native orientation lock differ.
