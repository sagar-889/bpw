# Buzzpay APK Download

Place your Buzzpay Android APK file in this directory.

## Setup Instructions:

1. Build your Android APK using Android Studio or React Native
2. Name the file: `buzzpay.apk`
3. Place it in this `downloads` folder
4. Users will be able to download it after registration

## Alternative Hosting Options:

If you want to host the APK externally:
1. Upload to Google Drive, Dropbox, or AWS S3
2. Get the direct download link
3. Update the `apkUrl` in `script.js` with your link

Example:
```javascript
const apkUrl = 'https://your-domain.com/buzzpay.apk';
```

## Security Note:

For production:
- Enable HTTPS
- Sign your APK with a release key
- Consider using Google Play Store for distribution
