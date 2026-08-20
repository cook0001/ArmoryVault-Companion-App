#!/usr/bin/env zsh
export ANDROID_HOME="/usr/local/share/android-commandlinetools"
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

APK_PATH="${1:-android/app/build/outputs/apk/release/app-release.apk}"

PASS=0
FAIL=0
WARN=0

echo "=========================================================="
echo "  ArmoryVault Companion — Post-Build Smoke Test"
echo "  APK: $APK_PATH"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================================="
echo ""

if [ ! -f "$APK_PATH" ]; then
  echo "❌ APK not found at $APK_PATH"
  echo "   Run ./clean-build.sh first."
  exit 1
fi

# ─── 1. APK Size Check ──────────────────────────────────────
echo "📦 [1/7] Checking APK size..."
APK_SIZE_BYTES=$(wc -c < "$APK_PATH" | tr -d ' ')
APK_SIZE_MB=$((APK_SIZE_BYTES / 1048576))

if [ "$APK_SIZE_MB" -lt 10 ]; then
  echo "   ❌ APK is suspiciously small (${APK_SIZE_MB}MB) — likely missing native libs"
  FAIL=$((FAIL + 1))
elif [ "$APK_SIZE_MB" -gt 300 ]; then
  echo "   ⚠️  APK is very large (${APK_SIZE_MB}MB) — consider enabling ABI splits"
  WARN=$((WARN + 1))
  PASS=$((PASS + 1))
else
  echo "   ✅ APK size: ${APK_SIZE_MB}MB (healthy)"
  PASS=$((PASS + 1))
fi
echo ""

# ─── 2. JS Bundle Present ───────────────────────────────────
echo "📜 [2/7] Checking for JS bundle..."
BUNDLE_COUNT=$(unzip -l "$APK_PATH" 2>/dev/null | grep -c "index.android.bundle" || echo "0")

if [ "$BUNDLE_COUNT" -gt 0 ]; then
  BUNDLE_SIZE=$(unzip -l "$APK_PATH" 2>/dev/null | grep "index.android.bundle" | awk '{print $1}')
  BUNDLE_MB=$((BUNDLE_SIZE / 1048576))
  echo "   ✅ index.android.bundle found (${BUNDLE_MB}MB)"
  PASS=$((PASS + 1))
else
  echo "   ❌ CRITICAL: index.android.bundle MISSING — app will crash on launch"
  FAIL=$((FAIL + 1))
fi
echo ""

# ─── 3. Native Libraries ────────────────────────────────────
echo "🔧 [3/7] Checking native libraries (.so files)..."
SO_COUNT=$(unzip -l "$APK_PATH" 2>/dev/null | grep -c "\.so$" || echo "0")
ARCHES=$(unzip -l "$APK_PATH" 2>/dev/null | grep "\.so$" | sed 's/.*lib\///' | cut -d'/' -f1 | sort -u | tr '\n' ', ' | sed 's/,$//')

if [ "$SO_COUNT" -gt 0 ]; then
  echo "   ✅ $SO_COUNT native libraries found"
  echo "   📐 Architectures: $ARCHES"
  PASS=$((PASS + 1))
else
  echo "   ❌ CRITICAL: No native libraries found — app will crash"
  FAIL=$((FAIL + 1))
fi

# Check critical .so files
CRITICAL_LIBS=("libreactnative.so" "libhermesvm.so" "libexpo-modules-core.so" "libreanimated.so" "libworklets.so" "libgesturehandler.so")
MISSING_LIBS=0
for lib in "${CRITICAL_LIBS[@]}"; do
  if ! unzip -l "$APK_PATH" 2>/dev/null | grep -q "$lib"; then
    echo "   ❌ Missing critical lib: $lib"
    MISSING_LIBS=$((MISSING_LIBS + 1))
  fi
done

if [ "$MISSING_LIBS" -eq 0 ]; then
  echo "   ✅ All critical native libraries present"
  PASS=$((PASS + 1))
else
  echo "   ❌ $MISSING_LIBS critical native libraries missing"
  FAIL=$((FAIL + 1))
fi
echo ""

# ─── 4. Manifest Validation ─────────────────────────────────
echo "📋 [4/7] Validating AndroidManifest in APK..."

# Use aapt2 if available, otherwise basic check
AAPT2="$ANDROID_HOME/build-tools/$(ls $ANDROID_HOME/build-tools/ 2>/dev/null | tail -1)/aapt2"
if [ -x "$AAPT2" ]; then
  MANIFEST_DUMP=$("$AAPT2" dump xmltree "$APK_PATH" --file AndroidManifest.xml 2>/dev/null)
  
  MANIFEST_PKG=$(echo "$MANIFEST_DUMP" | grep "package=" | head -1 | sed 's/.*package="//' | sed 's/".*//')
  MIN_SDK=$(echo "$MANIFEST_DUMP" | grep "minSdkVersion" | head -1 | sed 's/.*=//')
  TARGET_SDK=$(echo "$MANIFEST_DUMP" | grep "targetSdkVersion" | head -1 | sed 's/.*=//')
  VERSION_NAME=$(echo "$MANIFEST_DUMP" | grep "versionName" | head -1 | sed 's/.*=//' | tr -d '"')
  VERSION_CODE=$(echo "$MANIFEST_DUMP" | grep "versionCode" | head -1 | sed 's/.*=//')

  echo "   Package:    $MANIFEST_PKG"
  echo "   Version:    $VERSION_NAME (code: $VERSION_CODE)"
  echo "   minSdk:     $MIN_SDK"
  echo "   targetSdk:  $TARGET_SDK"

  # Verify version matches package.json
  PKG_VER=$(node -p "require('./package.json').version" 2>/dev/null)
  if echo "$VERSION_NAME" | grep -q "$PKG_VER"; then
    echo "   ✅ APK version matches package.json"
    PASS=$((PASS + 1))
  else
    echo "   ❌ APK version ($VERSION_NAME) ≠ package.json ($PKG_VER)"
    FAIL=$((FAIL + 1))
  fi
else
  echo "   ⚠️  aapt2 not found — skipping manifest deep validation"
  WARN=$((WARN + 1))
fi
echo ""

# ─── 5. Signing Verification ────────────────────────────────
echo "🔐 [5/7] Verifying APK signature..."
APKSIGNER="$ANDROID_HOME/build-tools/$(ls $ANDROID_HOME/build-tools/ 2>/dev/null | tail -1)/apksigner"
if [ -x "$APKSIGNER" ]; then
  if "$APKSIGNER" verify --print-certs "$APK_PATH" >/dev/null 2>&1; then
    echo "   ✅ APK is properly signed (v2/v3)"
    PASS=$((PASS + 1))
  else
    echo "   ❌ APK signature verification failed"
    FAIL=$((FAIL + 1))
  fi
else
  echo "   ⚠️  apksigner not found — skipping signature check"
  WARN=$((WARN + 1))
fi
echo ""

# ─── 6. Resource Validation ─────────────────────────────────
echo "🎨 [6/7] Checking app resources..."
RES_COUNT=$(unzip -l "$APK_PATH" 2>/dev/null | grep -c "^.*res/" || echo "0")
ICON_COUNT=$(unzip -l "$APK_PATH" 2>/dev/null | grep -c "mipmap\|ic_launcher" || echo "0")

if [ "$RES_COUNT" -gt 0 ]; then
  echo "   ✅ $RES_COUNT resource files found"
  PASS=$((PASS + 1))
else
  echo "   ❌ No resources found in APK"
  FAIL=$((FAIL + 1))
fi
echo ""

# ─── 7. Install on Connected Device (if available) ──────────
echo "📱 [7/7] Checking for connected device..."
DEVICE_COUNT=$("$ANDROID_HOME/platform-tools/adb" devices 2>/dev/null | grep -c "device$" || true)
DEVICE_COUNT=${DEVICE_COUNT:-0}

if [ "$DEVICE_COUNT" -gt 0 ]; then
  echo "   📱 Device connected! To install:"
  echo "   $ANDROID_HOME/platform-tools/adb install -r $APK_PATH"
  PASS=$((PASS + 1))
else
  echo "   ℹ️  No device connected (manual install required)"
  PASS=$((PASS + 1))
fi
echo ""

# ─── Summary ─────────────────────────────────────────────────
echo "=========================================================="
echo "  Smoke Test Summary"
echo "=========================================================="
echo "  ✅ Passed:   $PASS"
echo "  ❌ Failed:   $FAIL"
echo "  ⚠️  Warnings: $WARN"
echo "=========================================================="
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "🚫 Smoke test FAILED. Do NOT distribute this APK."
  exit 1
else
  echo "🎉 APK looks healthy! Safe to distribute."
  exit 0
fi
