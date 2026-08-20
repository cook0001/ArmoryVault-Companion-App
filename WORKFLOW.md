# ArmoryVault Companion — Build & Release Workflow

> **Last Updated:** 2026-08-20 · **Nightly Repo** · SDK 57 / React Native 0.86.2

---

## Table of Contents
- [Quick Reference](#quick-reference)
- [Environment Setup](#environment-setup)
- [Build Scripts](#build-scripts)
- [Release Workflows](#release-workflows)
- [Native Safety](#native-safety)
- [Debugging](#debugging)
- [Troubleshooting](#troubleshooting)

---

## Quick Reference

```
┌─────────────────────────────────────────────────────────────────┐
│                    STANDARD RELEASE FLOW                        │
│                                                                 │
│  bump-version.sh  ➜  CHANGELOG.md  ➜  clean-build.sh           │
│        │                                      │                 │
│        ▼                                      ▼                 │
│  Updates 4 files              Runs preflight + full build       │
│  (package.json,                               │                 │
│   app.json,                                   ▼                 │
│   build.gradle,              smoke-test.sh  ➜  publish-*.sh     │
│   updater.ts)                Validates APK      Pushes to GH    │
└─────────────────────────────────────────────────────────────────┘
```

### One-Liner (Full Release)
```bash
# Nightly
./bump-version.sh 2.6.1-nightly.1 && \
  vim CHANGELOG.md && \
  ./clean-build.sh && \
  ./smoke-test.sh && \
  ./publish-nightly.sh

# Stable
./bump-version.sh 2.6.1 && \
  vim CHANGELOG.md && \
  ./clean-build.sh && \
  ./smoke-test.sh && \
  ./publish-release.sh
```

---

## Environment Setup

### Required Tools
| Tool | Minimum Version | Check Command |
|------|----------------|---------------|
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Java JDK | 17+ | `java --version` |
| Android SDK | API 36 | `$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --list` |
| GitHub CLI | 2.x | `gh --version` |

### Environment Variables
```bash
# Add to ~/.zshrc or ~/.bashrc
export ANDROID_HOME="/usr/local/share/android-commandlinetools"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
```

### First-Time Setup
```bash
# Clone and install
git clone https://github.com/cook0001/ArmoryVault-Companion-App.git
cd ArmoryVault-Companion-App
npm install

# Validate everything
./preflight.sh
```

---

## Build Scripts

### `./preflight.sh` — Pre-Build Validation
**Run before every build.** Catches issues that would cause runtime crashes.

```bash
./preflight.sh
```

**What it checks:**
- ✅ Version consistency across `package.json`, `app.json`, `build.gradle`, and `updater.ts`
- ✅ `npx expo-doctor` — peer dependency validation, SDK compatibility
- ✅ Native autolinking verification (catches missing native modules)
- ✅ Stale CXX/CMake cache detection (catches ABI mismatch bugs)
- ✅ Gradle properties validation (JVM memory, build tools)
- ✅ Keystore presence check

**When preflight fails:**
- Missing peer deps → `npx expo install <package>`
- Version mismatch → `./bump-version.sh <correct-version>`
- Stale caches → `./clean-build.sh` (auto-cleans)

---

### `./bump-version.sh <version>` — Atomic Version Bump
Updates the version in **all 4 files** atomically in one command.

```bash
./bump-version.sh 2.6.0-nightly.38
```

**Files updated:**
| File | Field |
|------|-------|
| `package.json` | `version` |
| `app.json` | `expo.version` |
| `android/app/build.gradle` | `versionName` + `versionCode` (auto-incremented) |
| `utils/updater.ts` | Hardcoded fallback version string |

**Version format examples:**
- Nightly: `2.6.0-nightly.38`
- Stable: `2.6.1`
- Beta: `2.7.0-beta.1`

---

### `./clean-build.sh [arch]` — Full Clean Build
Purges all caches, backs up native modifications, runs preflight, and produces a fresh release APK.

```bash
# Full build (all architectures — ~130MB APK)
./clean-build.sh

# Single architecture (faster, smaller APK for testing)
./clean-build.sh arm64
```

**What it does (in order):**
1. Backs up native modifications (calls `native-backup.sh`)
2. Purges `android/app/build`, `android/app/.cxx`, `android/.gradle`
3. Clears Metro bundler cache
4. Runs `preflight.sh`
5. Executes `gradlew assembleRelease` with parallel workers

**Build time:** ~12 minutes (M-series Mac)

**Output:** `android/app/build/outputs/apk/release/app-release.apk`

---

### `./smoke-test.sh` — Post-Build APK Validation
Validates the built APK before distribution.

```bash
./smoke-test.sh
```

**7-Point inspection:**
| # | Check | What it validates |
|---|-------|-------------------|
| 1 | APK Size | Not empty, not suspiciously small |
| 2 | JS Bundle | `index.android.bundle` exists and has content |
| 3 | Native Libs | All critical `.so` files present (hermes, RN, expo modules) |
| 4 | Manifest | Package name, version, minSdk, targetSdk match expectations |
| 5 | Signature | APK is properly signed (v2/v3 via `apksigner`) |
| 6 | Resources | Drawable resources, splash screen assets present |
| 7 | Device | Detects connected ADB device for install |

**Exit codes:**
- `0` — All checks passed, safe to distribute
- `1` — One or more checks failed, DO NOT distribute

---

### `./native-backup.sh` — Snapshot Native Modifications
Creates a timestamped backup of all manually-modified native files.

```bash
./native-backup.sh
```

**Files backed up:**
- `android/app/build.gradle` (custom versioning)
- `android/app/src/main/AndroidManifest.xml` (cleartext, permissions)
- `android/app/src/main/java/.../MainActivity.kt`
- `android/app/src/main/java/.../MainApplication.kt`
- `android/app/src/main/res/` (splash screen drawables, styles.xml)
- `android/gradle.properties` (JVM args)
- Keystore files

**Backups stored in:** `native-backups/<timestamp>/`

> ⚠️ **CRITICAL RULE:** Never run `npx expo prebuild --clean` without first running `native-backup.sh`. The prebuild command wipes all native modifications.

---

### `./native-restore.sh [backup-dir]` — Restore Native Modifications
Restores native files from a backup snapshot.

```bash
# Restore from latest backup
./native-restore.sh

# Restore from specific backup
./native-restore.sh native-backups/2026-08-20_173500
```

---

## Release Workflows

### Nightly Prerelease
```bash
# 1. Bump version
./bump-version.sh 2.6.0-nightly.38

# 2. Document changes in CHANGELOG.md
# Add entry under: ## [2.6.0-nightly.38] - YYYY-MM-DD (Nightly Test Build)

# 3. Build, validate, publish
./clean-build.sh
./smoke-test.sh
./publish-nightly.sh          # Tags as --prerelease on GitHub
```

### Stable Release
```bash
# 1. Bump version (no -nightly suffix)
./bump-version.sh 2.6.1

# 2. Document changes in CHANGELOG.md

# 3. Build, validate, publish
./clean-build.sh
./smoke-test.sh
./publish-release.sh          # Tags as latest release on GitHub
```

### Quick Republish (No Rebuild)
If you just need to re-upload an existing APK:
```bash
./publish-release-no-build.sh
```

### Deploy to Connected Device
```bash
# After build, install directly via ADB
$ANDROID_HOME/platform-tools/adb install -r android/app/build/outputs/apk/release/app-release.apk
```

---

## Native Safety

### The Golden Rule
> **Never blindly run `npx expo prebuild --clean`.** It destroys custom native modifications.

### Safe Prebuild Procedure
If you absolutely must regenerate native files:
```bash
# 1. Backup FIRST
./native-backup.sh

# 2. Run prebuild
npx expo prebuild --clean

# 3. Restore custom modifications
./native-restore.sh

# 4. Verify
./preflight.sh
```

### What We've Manually Modified
| File | Modification | Why |
|------|-------------|-----|
| `build.gradle` | Custom `versionCode`/`versionName` | Atomic versioning with bump-version.sh |
| `AndroidManifest.xml` | `usesCleartextTraffic=true` | Local Wi-Fi sync with desktop app |
| `gradle.properties` | `-Xmx3072m` JVM args | Prevent OOM during large builds |
| `res/drawable-*` | Splash screen PNGs | Custom branded splash |
| `styles.xml` | `Theme.App.SplashScreen` | Required by expo-splash-screen |

---

## Debugging

### Crash Diagnostics (ADB Logcat)
```bash
ADB="$ANDROID_HOME/platform-tools/adb"

# Clear logs, launch app, capture crash
$ADB logcat -c
$ADB shell am start -n com.armoryvault.companion/.MainActivity
sleep 3
$ADB logcat -d -s AndroidRuntime:E | tail -50
```

### Common Crash Patterns
| Error | Cause | Fix |
|-------|-------|-----|
| `UnsatisfiedLinkError: dlopen failed` | Native `.so` ABI mismatch | Remove/update the incompatible package |
| `java.lang.ClassNotFoundException` | Missing native module | Run `npx expo-doctor`, install peer deps |
| `Resources$NotFoundException` | Missing drawable/style | Check `res/` folders, restore native backup |
| `Unable to load script` | Missing JS bundle | `./clean-build.sh` to regenerate |

### Dependency Health Check
```bash
# Check for deprecated/incompatible packages
npx expo-doctor

# Check for outdated packages
npm outdated

# Check for security vulnerabilities
npm audit

# Update all Expo SDK patches
npx expo install --fix
```

---

## Troubleshooting

### Build fails with OOM
```bash
# Increase Gradle JVM memory
echo "org.gradle.jvmargs=-Xmx4096m" >> android/gradle.properties
```

### Build succeeds but app crashes on launch
```bash
# 1. Connect phone via USB (enable USB Debugging)
# 2. Capture the crash log
$ANDROID_HOME/platform-tools/adb logcat -d -s AndroidRuntime:E | tail -30

# 3. Common fixes:
npx expo-doctor                    # Check for missing peer deps
npx expo install --fix             # Update SDK-compatible versions
./clean-build.sh                   # Full cache purge + rebuild
```

### Versions out of sync
```bash
# Check current versions across all files
grep '"version"' package.json
grep '"version"' app.json
grep 'versionName' android/app/build.gradle
grep 'CURRENT_VERSION' utils/updater.ts

# Fix with atomic bump
./bump-version.sh <correct-version>
```

### Stale native cache causing ABI errors
```bash
# Nuclear option — full clean
rm -rf android/app/build android/app/.cxx android/.gradle
rm -rf node_modules/.cache
./clean-build.sh
```
