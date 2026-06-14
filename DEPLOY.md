# Dicestorm — Play Store deploy guide

App id: **com.dicestorm.app** · current version: **1.0.0 (versionCode 1)**

## One-time setup you must do (account-bound, can't be scripted)

1. **Google Play Developer account** — register at <https://play.google.com/console>
   (one-time US$25). Required to publish anything.
2. **Create the app** in Play Console → *Create app* → name "Dicestorm", type App, Free.
3. **Privacy policy URL** — Play requires one. Use the hosted page:
   `https://buchiboom.github.io/wardice/privacy.html`
   (paste under *App content → Privacy policy*).
4. **Data safety form** — declare: *no data collected, no data shared*.
5. **Content rating** questionnaire — it's a dice utility, no objectionable content.

This build has **no ads and no in-app purchases**.

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

- The web PWA (GitHub Pages) and the Play app share the same code; only the native
  orientation lock differs (it uses the screen-orientation plugin in the packaged app).
