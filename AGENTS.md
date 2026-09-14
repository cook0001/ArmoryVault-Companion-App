# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Package-Centric Version Control and Changelog

- **Lock Versions During Active Development**: During feature development and iterative bug fixing, NEVER bump the version or increment `versionCode`. Versions in `package.json`, `app.json`, and `android/app/build.gradle` remain strictly LOCKED in development. Changes MUST be accumulated and documented in `CHANGELOG.md` under an `[Unreleased]` or in-progress release header.
- **Atomic Final Release Bumping**: The version and native `versionCode` are ONLY bumped when the user explicitly requests to finalize and package the release. At that time, determine the bump according to the rules in `VersionControl` (Major.Minor.Patch), increment `versionName`, strictly increment `versionCode` (which must NEVER drop below 300 / current baseline >= 309), and finalize `CHANGELOG.md`.
- **Pre-Push Integrity**: EVERY TIME before pushing to GitHub or publishing, you MUST ensure that the `CHANGELOG.md`, `README.md`, and `.gitignore` files are properly updated to reflect the new changes, scripts, or build artifacts.

# 8. Android Native VersionCode Monotonic Increase (Strict)
- **Strict VersionCode Increment**: In `android/app/build.gradle` and `app.json`, `versionCode` MUST strictly increment with every build and NEVER be decremented, reset, or set below the established production baseline (currently `>= 309`). Setting a `versionCode` lower than or equal to an installed build causes Android PackageInstaller and the in-app OTA updater to immediately reject APK installations with `INSTALL_FAILED_VERSION_DOWNGRADE` ("App not installed / Update not installed").
- **Unified Release Stream**: All builds belong to a single, unified release stream with strictly monotonic version numbers and version codes. Nightly channels and offset rules have been permanently deprecated.


# Native Android Integrity
**Never blindly run `npx expo prebuild --clean`**. We have manually modified `android/app/build.gradle` (for native versioning) and other native files. Wiping the `android/` directory will destroy our custom native tweaks. You must explicitly back up and restore native modifications if you ever need to regenerate the native folders.

# Cross-Platform Safety
When using platform-specific APIs (like `expo-intent-launcher` on Android), you MUST wrap the logic in a `Platform.OS === 'android'` check to ensure the app does not crash when compiled and run on iOS.

# Strict Package Manager
Always use `npm` for installing dependencies. Do NOT use `yarn` or `pnpm`. This ensures our `package-lock.json` remains the sole source of truth and prevents dependency tree corruption.

# Desktop Sync Compatibility
Any changes to JSON payloads, database schemas, or API routes used for syncing with the ArmoryVault Desktop app MUST be backwards compatible. If breaking changes are absolutely required, you MUST also update the ArmoryVault Desktop Electron app in tandem to match. If the desktop app repository is not currently open, ask the user for its path so you can update it simultaneously.
