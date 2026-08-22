#!/usr/bin/env zsh
export ANDROID_HOME="/usr/local/share/android-commandlinetools"
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

PASS=0
FAIL=0
WARN=0

echo "=========================================================="
echo "  ArmoryVault Companion — Pre-Flight Build Validation"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================================="
echo ""

# ─── 1. Version & VersionCode Consistency Check ──────────────────
echo "🔍 [1/6] Checking version and versionCode consistency across files..."

PKG_VER=$(node -p "require('./package.json').version" 2>/dev/null)
APP_VER=$(node -p "require('./app.json').expo.version" 2>/dev/null)
GRADLE_VER=$(grep 'versionName' android/app/build.gradle 2>/dev/null | head -1 | sed 's/.*"\(.*\)".*/\1/')
UPDATER_VER=$(grep "nativeApplicationVersion ||" utils/updater.ts 2>/dev/null | sed "s/.*|| '\([^']*\)'.*/\1/")

GRADLE_VCODE=$(grep 'versionCode' android/app/build.gradle 2>/dev/null | head -1 | tr -dc '0-9')
APP_VCODE=$(node -p "require('./app.json').expo.android?.versionCode || ''" 2>/dev/null)

ALL_MATCH=true
if [ "$PKG_VER" != "$APP_VER" ]; then
  echo "   ❌ package.json ($PKG_VER) ≠ app.json ($APP_VER)"
  ALL_MATCH=false
fi
if [ -n "$GRADLE_VER" ] && [ "$PKG_VER" != "$GRADLE_VER" ]; then
  echo "   ❌ package.json ($PKG_VER) ≠ build.gradle ($GRADLE_VER)"
  ALL_MATCH=false
fi
if [ -n "$UPDATER_VER" ] && [ "$PKG_VER" != "$UPDATER_VER" ]; then
  echo "   ❌ package.json ($PKG_VER) ≠ updater.ts ($UPDATER_VER)"
  ALL_MATCH=false
fi

# Strict VersionCode baseline & consistency check
if [ -n "$GRADLE_VCODE" ] && [ "$GRADLE_VCODE" -lt 300 ]; then
  echo "   ❌ CRITICAL: versionCode ($GRADLE_VCODE) is below minimum baseline (300). Android OTA updates will fail with INSTALL_FAILED_VERSION_DOWNGRADE!"
  ALL_MATCH=false
fi
if [ -n "$APP_VCODE" ] && [ "$APP_VCODE" != "$GRADLE_VCODE" ]; then
  echo "   ❌ app.json android.versionCode ($APP_VCODE) ≠ build.gradle versionCode ($GRADLE_VCODE)"
  ALL_MATCH=false
fi

# Active ADB device upgrade validation
ADB_BIN="/usr/local/share/android-commandlinetools/platform-tools/adb"
if [ ! -f "$ADB_BIN" ]; then ADB_BIN="adb"; fi
if command -v "$ADB_BIN" &>/dev/null; then
  DEVICE_ID=$($ADB_BIN devices 2>/dev/null | grep -v "List of devices" | grep "device$" | head -1 | awk '{print $1}')
  if [ -n "$DEVICE_ID" ]; then
    INSTALLED_VCODE=$($ADB_BIN -s "$DEVICE_ID" shell dumpsys package com.armoryvault.companion 2>/dev/null | grep 'versionCode=' | head -1 | sed 's/.*versionCode=\([0-9]*\).*/\1/')
    if [ -n "$INSTALLED_VCODE" ] && [ -n "$GRADLE_VCODE" ]; then
      if [ "$GRADLE_VCODE" -le "$INSTALLED_VCODE" ]; then
        echo "   ❌ CRITICAL: Target versionCode ($GRADLE_VCODE) is <= device installed versionCode ($INSTALLED_VCODE). OTA update will be rejected by Android PackageInstaller!"
        ALL_MATCH=false
      else
        echo "   📱 Connected Device ($DEVICE_ID): Target vCode $GRADLE_VCODE > Installed vCode $INSTALLED_VCODE (Upgrade guaranteed)"
      fi
    fi
  fi
fi

if $ALL_MATCH; then
  echo "   ✅ All files report v$PKG_VER (versionCode $GRADLE_VCODE)"
  PASS=$((PASS + 1))
else
  echo "   Run ./bump-version.sh to fix version mismatches."
  FAIL=$((FAIL + 1))
fi
echo ""

# ─── 2. Expo Doctor ──────────────────────────────────────────
echo "🩺 [2/6] Running expo-doctor..."
DOCTOR_OUT=$(npx -y expo-doctor 2>&1)
DOCTOR_FAIL=$(echo "$DOCTOR_OUT" | grep -c "✖" || true)

if [ "$DOCTOR_FAIL" -gt 0 ]; then
  echo "$DOCTOR_OUT" | grep -A3 "✖"
  echo ""
  echo "   ❌ expo-doctor found $DOCTOR_FAIL issue(s)"
  FAIL=$((FAIL + 1))
else
  echo "   ✅ expo-doctor: all checks passed"
  PASS=$((PASS + 1))
fi
echo ""

# ─── 3. Critical Peer Dependencies ──────────────────────────
echo "📦 [3/6] Checking critical peer dependencies..."

MISSING_PEERS=0
# expo-font is required by @expo/vector-icons (crash without it)
if [ ! -d "node_modules/expo-font" ]; then
  echo "   ❌ MISSING: expo-font (required by @expo/vector-icons — app WILL crash)"
  MISSING_PEERS=$((MISSING_PEERS + 1))
fi
# react-native-reanimated is required by expo-router
if [ ! -d "node_modules/react-native-reanimated" ]; then
  echo "   ❌ MISSING: react-native-reanimated (required by expo-router)"
  MISSING_PEERS=$((MISSING_PEERS + 1))
fi
# react-native-gesture-handler is required by expo-router
if [ ! -d "node_modules/react-native-gesture-handler" ]; then
  echo "   ❌ MISSING: react-native-gesture-handler (required by expo-router)"
  MISSING_PEERS=$((MISSING_PEERS + 1))
fi
# react-native-safe-area-context
if [ ! -d "node_modules/react-native-safe-area-context" ]; then
  echo "   ❌ MISSING: react-native-safe-area-context"
  MISSING_PEERS=$((MISSING_PEERS + 1))
fi
# react-native-screens
if [ ! -d "node_modules/react-native-screens" ]; then
  echo "   ❌ MISSING: react-native-screens"
  MISSING_PEERS=$((MISSING_PEERS + 1))
fi

if [ "$MISSING_PEERS" -eq 0 ]; then
  echo "   ✅ All critical peer dependencies present"
  PASS=$((PASS + 1))
else
  echo "   Fix: npx expo install expo-font react-native-reanimated react-native-gesture-handler"
  FAIL=$((FAIL + 1))
fi
echo ""

# ─── 4. Native Module Autolinking ────────────────────────────
echo "🔗 [4/6] Verifying native module autolinking (Android)..."
AUTOLINK_COUNT=$(npx expo-modules-autolinking resolve -p android 2>/dev/null | grep -c "packageName" || echo "0")
if [ "$AUTOLINK_COUNT" -gt 0 ]; then
  echo "   ✅ $AUTOLINK_COUNT native modules autolinked for Android"
  PASS=$((PASS + 1))
else
  echo "   ❌ Autolinking returned 0 modules — native build will likely fail"
  FAIL=$((FAIL + 1))
fi
echo ""

# ─── 5. Stale Build Cache Detection ─────────────────────────
echo "🗑️  [5/6] Checking for stale build caches..."

STALE=0
if [ -d "android/app/.cxx" ]; then
  # Check if .cxx paths reference a different project directory
  BAD_PATHS=$(find android/app/.cxx -name "build_command.txt" -exec grep -l "ArmoryVault_Companion/" {} \; 2>/dev/null | head -1)
  if [ -n "$BAD_PATHS" ]; then
    echo "   ⚠️  Stale CXX cache references old project directory"
    echo "   Fix: rm -rf android/app/.cxx"
    STALE=$((STALE + 1))
  fi
fi

if [ "$STALE" -gt 0 ]; then
  echo "   ❌ Found $STALE stale cache issue(s) — run ./clean-build.sh"
  FAIL=$((FAIL + 1))
else
  echo "   ✅ No stale caches detected"
  PASS=$((PASS + 1))
fi
echo ""

# ─── 6. AndroidManifest & Native Config ──────────────────────
echo "📋 [6/6] Validating native configuration..."

NATIVE_ISSUES=0
# Check for leftover expo-updates in the manifest
if grep -q "expo-updates\|ExpoUpdates" android/app/src/main/AndroidManifest.xml 2>/dev/null; then
  echo "   ⚠️  AndroidManifest.xml still references expo-updates"
  NATIVE_ISSUES=$((NATIVE_ISSUES + 1))
fi

# Check keystore exists
if [ ! -f "android/app/debug.keystore" ]; then
  echo "   ❌ debug.keystore missing — release signing will fail"
  NATIVE_ISSUES=$((NATIVE_ISSUES + 1))
fi

# Check splash drawables exist
SPLASH_COUNT=$(find android/app/src/main/res -name "splashscreen_logo*" 2>/dev/null | wc -l | tr -d ' ')
if [ "$SPLASH_COUNT" -eq 0 ]; then
  echo "   ❌ No splash screen drawables found — app will crash on launch"
  NATIVE_ISSUES=$((NATIVE_ISSUES + 1))
fi

if [ "$NATIVE_ISSUES" -eq 0 ]; then
  echo "   ✅ Native configuration looks good"
  PASS=$((PASS + 1))
else
  FAIL=$((FAIL + 1))
fi
echo ""

# ─── Summary ─────────────────────────────────────────────────
echo "=========================================================="
echo "  Pre-Flight Summary"
echo "=========================================================="
echo "  ✅ Passed: $PASS"
echo "  ❌ Failed: $FAIL"
echo "=========================================================="
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "🚫 Pre-flight checks FAILED. Fix the issues above before building."
  exit 1
else
  echo "🚀 All pre-flight checks passed. Safe to build!"
  exit 0
fi
