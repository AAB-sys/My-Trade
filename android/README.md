# My-Trade for Android

The dashboard as an app on the phone: one full-screen view of your own server, the screen kept awake
while it is open (the page watches the market and records the paper calls' premiums), the login's tab
note travelling from page to page, and **Download CSV** saving to the phone's Downloads folder.
Nothing secret is in the app: it asks the server for the dashboard password like any browser, and the
Dhan token never leaves the server.

## Installing it

GitHub builds the app for you. On the repository's **Releases** page there is a release called
"My-Trade Android app (latest build)" with a file **My-Trade.apk**.

1. On the phone, open the Releases page in the browser and tap **My-Trade.apk**.
2. Open the downloaded file. Android asks once to allow installs from the browser: allow it.
3. Open My-Trade from the home screen. The first time it asks for the dashboard address, with the
   Render link filled in. Tap Open, then log in with the dashboard password.

A new build installs over the old one, with the same icon. Tapping the file again is all it takes.

## Changing the dashboard address

If the server ever moves (the laptop on the home network, another host), the app shows "Cannot reach
the dashboard" with a link to change the address. The address is kept on the phone only.

## How it is built

`.github/workflows/android.yml` builds `android/` with Gradle on GitHub's machines whenever these
files change on `main` (or by hand from the Actions page), and publishes the APK under the
`app-latest` release. The app is signed with the key in `android/keystore/`, a personal key for
installing on the owner's own phone, not a store key.
