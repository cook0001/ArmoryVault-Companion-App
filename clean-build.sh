#!/usr/bin/env zsh
export ANDROID_HOME="/usr/local/share/android-commandlinetools"
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

ARCH="${1:-all}"
SKIP_PREFLIGHT="${2:-}"

echo "=========================================================="
echo "  ArmoryVault Companion (Stable) — Clean Build Engine"
echo "  Architecture: $( [ "$ARCH" = "all" ] && echo "All (armeabi-v7a, arm64-v8a, x86, x86_64)" || echo "$ARCH" )"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================================="
echo ""

# ─── 1. Pre-flight (optional skip) ──────────────────────────
if [ "$SKIP_PREFLIGHT" != "--skip-preflight" ]; then
  echo "🔍 Running pre-flight checks..."
  if [ -f "$DIR/preflight.sh" ]; then
    if ! "$DIR/preflight.sh"; then
      echo ""
      echo "🚫 Pre-flight failed. Fix issues above or re-run with:"
      echo "   ./clean-build.sh $ARCH --skip-preflight"
      exit 1
    fi
  else
    echo "   ⚠️  preflight.sh not found — skipping validation"
  fi
  echo ""
fi

# ─── 2. Back Up Native Modifications ────────────────────────
echo "💾 Backing up native modifications..."
BACKUP_DIR="/tmp/armoryvault-stable-native-backup-$(date +%s)"
mkdir -p "$BACKUP_DIR"

cp android/app/build.gradle "$BACKUP_DIR/" 2>/dev/null || true
cp android/app/src/main/AndroidManifest.xml "$BACKUP_DIR/" 2>/dev/null || true
cp android/app/proguard-rules.pro "$BACKUP_DIR/" 2>/dev/null || true
cp android/app/src/main/java/com/armoryvault/companion/MainActivity.kt "$BACKUP_DIR/" 2>/dev/null || true
cp android/app/src/main/java/com/armoryvault/companion/MainApplication.kt "$BACKUP_DIR/" 2>/dev/null || true
cp -r android/app/src/main/res "$BACKUP_DIR/res" 2>/dev/null || true
echo "   ✅ Backed up to $BACKUP_DIR"
echo ""

# ─── 3. Purge ALL Build Caches ──────────────────────────────
echo "🗑️  Purging build caches..."

echo "   • Gradle build output..."
rm -rf android/app/build

echo "   • CXX / CMake caches..."
rm -rf android/app/.cxx

echo "   • Gradle project cache..."
rm -rf android/.gradle

echo "   • Metro / Expo cache..."
rm -rf .expo/web .expo/dev
rm -rf /tmp/metro-* /tmp/haste-map-* 2>/dev/null || true

echo "   ✅ All caches purged"
echo ""

# ─── 4. Build Release APK ───────────────────────────────────
echo "🔨 Building release APK..."
export CMAKE_BUILD_PARALLEL_LEVEL=$(sysctl -n hw.ncpu 2>/dev/null || echo 8)

BUILD_START=$(date +%s)
pushd "$DIR/android" > /dev/null

if [ "$ARCH" = "all" ]; then
  ./gradlew assembleRelease --parallel --build-cache --max-workers=8
else
  ./gradlew assembleRelease -PreactNativeArchitectures="$ARCH" --parallel --build-cache --max-workers=8
fi

popd > /dev/null
BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))

APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
if [ -f "$APK_PATH" ]; then
  APK_SIZE=$(du -h "$APK_PATH" | awk '{print $1}')
  echo ""
  echo "=========================================================="
  echo "  ✅ Clean Build Complete!"
  echo "  📦 APK: $APK_PATH ($APK_SIZE)"
  echo "  ⏱️  Build time: ${BUILD_TIME}s"
  echo "  💾 Native backup: $BACKUP_DIR"
  echo "=========================================================="
  echo ""
  echo "Next: Run ./smoke-test.sh to validate the APK"
else
  echo ""
  echo "❌ Build failed — no APK produced"
  echo "💾 Native backup available at: $BACKUP_DIR"
  exit 1
fi
