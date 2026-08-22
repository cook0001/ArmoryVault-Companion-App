#!/usr/bin/env zsh
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# ─── Usage ───────────────────────────────────────────────────
usage() {
  echo "Usage: ./bump-version.sh <new-version> [new-version-code]"
  echo ""
  echo "Bumps the version across all project files atomically."
  echo ""
  echo "Examples:"
  echo "  ./bump-version.sh 2.6.0        # Auto-increments versionCode"
  echo "  ./bump-version.sh 2.6.0 302    # Explicitly sets versionCode 302"
  echo ""
  echo "Files updated:"
  echo "  • package.json             (version)"
  echo "  • app.json                 (expo.version + expo.android.versionCode)"
  echo "  • android/app/build.gradle (versionCode + versionName)"
  echo "  • utils/updater.ts         (fallback version string)"
  exit 1
}

if [ -z "$1" ]; then
  usage
fi

NEW_VERSION="$1"
OLD_VERSION=$(node -p "require('./package.json').version")
OLD_VCODE=$(grep 'versionCode' android/app/build.gradle 2>/dev/null | head -1 | tr -dc '0-9')

if [ -z "$OLD_VCODE" ]; then
  OLD_VCODE=0
fi

if [ -n "$2" ]; then
  NEW_VCODE="$2"
else
  # Ensure baseline of >= 300
  if [ "$OLD_VCODE" -lt 300 ]; then
    NEW_VCODE=300
  else
    NEW_VCODE=$((OLD_VCODE + 1))
  fi
fi

echo "=========================================================="
echo "  ArmoryVault Companion (Stable) — Version Bump"
echo "=========================================================="
echo "  Old: v$OLD_VERSION (versionCode $OLD_VCODE)"
echo "  New: v$NEW_VERSION (versionCode $NEW_VCODE)"
echo "=========================================================="
echo ""

# ─── 1. package.json ─────────────────────────────────────────
echo "📦 Updating package.json..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
echo "   ✅ package.json → v$NEW_VERSION"

# ─── 2. app.json ─────────────────────────────────────────────
echo "📱 Updating app.json..."
node -e "
const fs = require('fs');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
app.expo.version = '$NEW_VERSION';
if (!app.expo.android) app.expo.android = {};
app.expo.android.versionCode = $NEW_VCODE;
fs.writeFileSync('app.json', JSON.stringify(app, null, 2) + '\n');
"
echo "   ✅ app.json → v$NEW_VERSION (versionCode $NEW_VCODE)"

# ─── 3. build.gradle ─────────────────────────────────────────
echo "🤖 Updating android/app/build.gradle..."
if [ -f "android/app/build.gradle" ]; then
  sed -i '' "s/versionCode [0-9]*/versionCode $NEW_VCODE/" android/app/build.gradle
  sed -i '' "s/versionName \"[^\"]*\"/versionName \"$NEW_VERSION\"/" android/app/build.gradle
  echo "   ✅ build.gradle → v$NEW_VERSION (code $NEW_VCODE)"
else
  echo "   ⚠️  android/app/build.gradle not found"
fi

# ─── 4. utils/updater.ts ─────────────────────────────────────
echo "🔄 Updating utils/updater.ts fallback..."
if [ -f "utils/updater.ts" ]; then
  sed -i '' "s/nativeApplicationVersion || '[^']*'/nativeApplicationVersion || '$NEW_VERSION'/" utils/updater.ts
  echo "   ✅ utils/updater.ts fallback → $NEW_VERSION"
fi

echo ""
echo "=========================================================="
echo "  ✅ Version bumped to v$NEW_VERSION (code $NEW_VCODE)!"
echo "=========================================================="
echo ""
