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

## Compiling for Android
To build a standalone APK for your Android device:
```bash
npx eas-cli build -p android --profile preview
```
