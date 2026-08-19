#!/usr/bin/env zsh
export ANDROID_HOME="/usr/local/share/android-commandlinetools"
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
ARCH="${1:-arm64-v8a}"
BUILD_TYPE="${2:-Release}"

echo "=========================================================="
echo "  ArmoryVault Companion - Turbo Local Build Engine"
echo "  Target Architecture: $ARCH"
echo "  Build Type:          $BUILD_TYPE"
echo "=========================================================="

export CMAKE_BUILD_PARALLEL_LEVEL=$(sysctl -n hw.ncpu 2>/dev/null || echo 8)

pushd "$DIR/android" > /dev/null

if [ "$BUILD_TYPE" = "Debug" ] || [ "$BUILD_TYPE" = "debug" ]; then
  TASK="assembleDebug"
  OUT_APK="app/build/outputs/apk/debug/app-debug.apk"
else
  TASK="assembleRelease"
  OUT_APK="app/build/outputs/apk/release/app-release.apk"
fi

echo "Running ./gradlew $TASK with 8-core parallelism and build cache..."
./gradlew "$TASK" \
  -PreactNativeArchitectures="$ARCH" \
  --parallel \
  --build-cache \
  --max-workers=8

popd > /dev/null

if [ -f "$DIR/android/$OUT_APK" ]; then
  APK_SIZE=$(du -h "$DIR/android/$OUT_APK" | awk '{print $1}')
  echo ""
  echo "✅ Fast Local Build Complete!"
  echo "📦 APK Output: $DIR/android/$OUT_APK ($APK_SIZE)"
  echo "💡 Tip: To build for all architectures for distribution, run ./publish-nightly.sh"
else
  echo "❌ Error: Expected APK at $DIR/android/$OUT_APK not found."
  exit 1
fi
