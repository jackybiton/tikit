# הוראות העלאה ל-GitHub ולבנייה באתר Expo

זאת התיקייה שצריך להעלות ל-GitHub:

```text
C:\Users\בי\BOT\טיק טל\github-upload-tiktok-user-feed
```

אל תעלה את התיקייה המקורית `android-feed-app` עם `node_modules`.

## מה עושים

1. פתח GitHub Desktop.
2. בחר `Add an Existing Repository from your hard drive`.
3. בחר את התיקייה:

```text
C:\Users\בי\BOT\טיק טל\github-upload-tiktok-user-feed
```

4. אם GitHub Desktop אומר שזה לא repository, בחר ליצור repository חדש מהתיקייה הזאת.
5. לחץ `Publish repository`.
6. באתר Expo חבר את הפרויקט ל-GitHub.
7. בנה Android עם profile:

```text
preview
```

זה אמור ליצור APK.

## חשוב

האפליקציה עדיין צריכה שרת פעיל כדי לשאוב סרטונים. אם הטלפון לא באותו Wi-Fi, הפעל במחשב:

```powershell
.\run_feed_server_for_apk.bat
.\start_ngrok_tunnel.bat
```

ואת כתובת ה-ngrok שמתחילה ב-`https://` מדביקים באפליקציה בשדה `API server URL`.
