# ArmoryVault Companion App

[![Continuous Integration](https://github.com/cook0001/ArmoryVault-Companion-App/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/cook0001/ArmoryVault-Companion-App/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/cook0001/ArmoryVault-Companion-App?style=flat-square&color=emerald&label=Release)](https://github.com/cook0001/ArmoryVault-Companion-App/releases/latest)
[![APK Size](https://img.shields.io/badge/APK-129%20MB%20Universal-blue?style=flat-square&logo=android)](https://github.com/cook0001/ArmoryVault-Companion-App/releases/latest)
[![Zero-Cloud Privacy](https://img.shields.io/badge/Privacy-100%25%20Zero--Cloud-brightgreen?style=flat-square)](SECURITY.md)
[![License](https://img.shields.io/badge/License-ISC-purple?style=flat-square)](LICENSE)

> 📖 **Official User Guide & Knowledge Base**: [https://cook0001.github.io/ArmoryVault/#docs](https://cook0001.github.io/ArmoryVault/#docs)

The official companion app for ArmoryVault, built with React Native and Expo. 
This mobile application connects securely over your local Wi-Fi to the ArmoryVault Desktop Electron app.

## Features
- **Automatic Background Sync:** Transmits pending range sessions, scans, and inventory audits automatically when connected to your desktop over Wi-Fi.
- **Target MOA Grouping Analyzer & Scope Zeroing:** Scale target photos with 1" grids or coins, plot bullet holes (POI), and calculate Extreme Spread, Mean Radius, MOA, and scope turret click adjustments.
- **Range Bag Packing Checklist ("Range Prep"):** Select guns -> auto-aggregates matching ammunition lots, magazines, and discipline gear presets (CCW, Precision, Steel Challenge).
- **Maintenance Lifecycle Milestones & Wear Gauges:** Track recoil springs, extractor, and deep cleaning with 1-tap service resets and malfunction root-cause diagnostics.
- **Offline DOPE & Ballistic Drop Calculator:** Simple Mode (commercial factory ammo database) and Advanced Mode (numerical G1 point-mass solver with environmental weather adjustments).
- **Private Bill of Sale PDF Generator:** Driver's License PDF417 scanner, statutory legal affirmations, dual touch signature canvas, and 1-tap SMS/Email/Print sharing.
- **100% On-Device Bench Voice Memos:** Private, zero-cloud audio notes with instant playback and 1-tap "Wipe All Voice Logs" purge controls.
- **Tactical Dark UI & Dialogs:** Custom dark confirmation modals and auto-dismissing toast notifications with haptics.
- **In-App OTA Updates:** Seamlessly check for official releases directly from Settings with 1-tap download and installation.

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

### Turbo Fast Local Builds (Hardware Accelerated)
For rapid on-device testing, use the single-ABI parallel build script:
```bash
./scripts/build-local-fast.sh
```
*(Leverages 8-core CPU parallelism, CMake `-j8`, Kotlin daemon, and Gradle build-caching to build for `arm64-v8a` modern phones in seconds)*

To build a full universal release APK manually:
```bash
cd android
./gradlew assembleRelease --parallel --build-cache
```
*(The generated APK will be located at `android/app/build/outputs/apk/release/app-release.apk`)*

## Publishing Releases to GitHub
You can use the provided scripts to automate GitHub releases:

1. **Auto-Build & Publish Release**: `./scripts/publish-release.sh`
   *(Builds the release APK and publishes an official release to GitHub)*

2. **Publish Only (No Build)**: `./scripts/publish-release-no-build.sh`
   *(Instantly uploads the current build artifact to GitHub)*

## Build Workflow Tools

| Script | Purpose |
|--------|---------|
| `./scripts/preflight.sh` | **Run before every build.** Validates version consistency, runs `expo-doctor`, checks peer dependencies, verifies native autolinking, and detects stale caches. |
| `./scripts/bump-version.sh <ver>` | Atomically bumps the version across `package.json`, `app.json`, `build.gradle`, and `updater.ts` in one command. |
| `./scripts/clean-build.sh [arch]` | Purges all build caches (CXX, CMake, Gradle, Metro), backs up native modifications, runs preflight, and produces a fresh release APK. |
| `./scripts/smoke-test.sh` | Post-build APK validation: checks size, JS bundle, native libs, manifest version, signature, and resources. |
| `./scripts/crash-report.sh` | Device crash diagnostics: captures crash logs, fatal exceptions, ANRs, and system info from connected Android phone. |
| `./scripts/debug-feature.sh` | On-device feature diagnostics: checks permissions, hardware, storage, Wi-Fi sync, biometrics, and runtime logs. |
| `./scripts/native-backup.sh` | Snapshots all manually-modified native files (build.gradle, AndroidManifest, Kotlin sources, resources, keystore) for safe recovery. |
| `./scripts/native-restore.sh [dir]` | Restores native files from a snapshot created by `native-backup.sh`. |

For complete documentation on workflows, native safety, and troubleshooting, see [WORKFLOW.md](./WORKFLOW.md).

### Recommended Build Flow
```bash
./scripts/bump-version.sh 2.7.10   # 1. Bump version
# Edit CHANGELOG.md               # 2. Document changes
./scripts/preflight.sh            # 3. Validate everything
./scripts/clean-build.sh          # 4. Clean build (includes preflight)
./scripts/smoke-test.sh           # 5. Validate the APK
./scripts/publish-release.sh      # 6. Ship it
```

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
