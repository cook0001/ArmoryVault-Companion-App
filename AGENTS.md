# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Version Control and Changelog

After making any bug fixes or changes, ALWAYS automatically bump the version in `package.json`, `app.json`, and `android/app/build.gradle` (incrementing both `versionName` and `versionCode`) according to the versioning rules specified in `VersionControl`, and document the changes in `CHANGELOG.md`.

Additionally, EVERY TIME before pushing to GitHub, you MUST ensure that the `CHANGELOG.md`, `README.md`, and `.gitignore` files are properly updated to reflect the new changes, scripts, or build artifacts.

# Native Android Integrity
**Never blindly run `npx expo prebuild --clean`**. We have manually modified `android/app/build.gradle` (for native versioning) and other native files. Wiping the `android/` directory will destroy our custom native tweaks. You must explicitly back up and restore native modifications if you ever need to regenerate the native folders.

# Cross-Platform Safety
When using platform-specific APIs (like `expo-intent-launcher` on Android), you MUST wrap the logic in a `Platform.OS === 'android'` check to ensure the app does not crash when compiled and run on iOS.

# Strict Package Manager
Always use `npm` for installing dependencies. Do NOT use `yarn` or `pnpm`. This ensures our `package-lock.json` remains the sole source of truth and prevents dependency tree corruption.

# Desktop Sync Compatibility
Any changes to JSON payloads, database schemas, or API routes used for syncing with the ArmoryVault Desktop app MUST be backwards compatible. If breaking changes are absolutely required, you MUST also update the ArmoryVault Desktop Electron app in tandem to match. If the desktop app repository is not currently open, ask the user for its path so you can update it simultaneously.
