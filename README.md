# ArmoryVault Companion App

The official companion app for ArmoryVault, built with React Native and Expo. 
This mobile application connects securely over your local Wi-Fi to the ArmoryVault Desktop Electron app.

## Features
- **Secure Offline-First Logging:** Scan custom QR codes to log range trips, maintenance, and ammo usage.
- **Direct Local Sync:** Push logs and photos directly to your local desktop vault—no cloud required.
- **Outbox Management:** Review and edit logs offline before pushing to the desktop.
- **Haptic UI:** Fast, reliable scanning with a tactile dark-mode aesthetic.

## Setup & Run
This project uses Expo.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npx expo start
   ```

## Running on Android (Standalone APK)
**Quick Install:** If you don't want to build the app yourself, you can download the latest pre-built `.apk` file directly from the [Releases](../../releases) tab and install it on your device!

To build a standalone APK for your Android device locally from source:
```bash
cd android
./gradlew assembleRelease
```
*(The generated APK will be located at `android/app/build/outputs/apk/release/app-release.apk`)*

## Publishing Releases to GitHub
You can use the provided scripts to automate GitHub releases:

1. **Auto-Build & Publish**: `./publish-release.sh`
   *(This script will automatically navigate into the `android/` folder, run the build command, and push the newly generated APK to GitHub)*

2. **Publish Only**: `./publish-release-no-build.sh`
   *(This script skips the build step and instantly uploads whatever APK is currently in your build output folder to GitHub)*

## Running on iOS (iPhone)
Because Apple restricts standalone app sideloading without a paid developer account, the easiest way to run the app on your iPhone is through **Expo Go**:

1. Download the **Expo Go** app from the Apple App Store.
2. Ensure your Mac and your iPhone are on the same Wi-Fi network.
3. Open your terminal, navigate to this project folder, and run:
   ```bash
   npx expo start
   ```
4. Open the Camera app on your iPhone and scan the QR code shown in your terminal.
5. Tap the prompt that appears to open the app directly inside Expo Go!
