# TikTok User Feed Android App

This Expo app shows a vertical TikTok-style feed for the TikTok users you add.

## Run the API

From the parent folder:

```powershell
python feed_api.py
```

The API runs on port `8765`.

## Run the app

```powershell
cd android-feed-app
npm install
npm run phone
```

Use `npm run android` only if Android Studio / Android SDK is installed and `adb` is available.

For the Android emulator, keep the server URL as:

```text
http://10.0.2.2:8765
```

For a real Android phone, replace it in the app with your computer IP, for example:

```text
http://192.168.1.23:8765
```

The phone and computer must be on the same Wi-Fi network.

## Notes

- Long press an account chip to remove it.
- Pull down on the feed to refresh.
- Tap the heart button on a video to save or remove it from Favorites.
- Use the All / Favorites switch to show only saved videos.
- The app uses the local Python API because TikTok extraction is much more reliable with `yt-dlp` on the server side.
