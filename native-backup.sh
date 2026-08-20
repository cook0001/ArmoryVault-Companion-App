#!/usr/bin/env zsh
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

BACKUP_BASE="${1:-/tmp/armoryvault-native-snapshot}"
BACKUP_DIR="$BACKUP_BASE-$(date +%Y%m%d-%H%M%S)"

echo "=========================================================="
echo "  ArmoryVault Companion — Native Backup"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================================="
echo ""

mkdir -p "$BACKUP_DIR"

# ─── Critical native files to preserve ───────────────────────
FILES_BACKED=0

backup_file() {
  local src="$1"
  local dest="$BACKUP_DIR/$2"
  if [ -f "$src" ]; then
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
    echo "   ✅ $src"
    FILES_BACKED=$((FILES_BACKED + 1))
  else
    echo "   ⚠️  $src (not found, skipping)"
  fi
}

backup_dir() {
  local src="$1"
  local dest="$BACKUP_DIR/$2"
  if [ -d "$src" ]; then
    mkdir -p "$(dirname "$dest")"
    cp -r "$src" "$dest"
    echo "   ✅ $src/"
    FILES_BACKED=$((FILES_BACKED + 1))
  else
    echo "   ⚠️  $src/ (not found, skipping)"
  fi
}

echo "📁 Backing up native files..."
echo ""

# Gradle config
backup_file "android/app/build.gradle" "build.gradle"
backup_file "android/gradle.properties" "gradle.properties"
backup_file "android/build.gradle" "root-build.gradle"
backup_file "android/settings.gradle" "settings.gradle"

# App manifest & ProGuard
backup_file "android/app/src/main/AndroidManifest.xml" "AndroidManifest.xml"
backup_file "android/app/proguard-rules.pro" "proguard-rules.pro"

# Kotlin source
backup_file "android/app/src/main/java/com/armoryvault/companion/MainActivity.kt" "MainActivity.kt"
backup_file "android/app/src/main/java/com/armoryvault/companion/MainApplication.kt" "MainApplication.kt"

# Resources (icons, splash, colors, styles, strings)
backup_dir "android/app/src/main/res" "res"

# Keystore
backup_file "android/app/debug.keystore" "debug.keystore"

echo ""
echo "=========================================================="
echo "  ✅ Backed up $FILES_BACKED items to:"
echo "     $BACKUP_DIR"
echo "=========================================================="
echo ""
echo "To restore:  ./native-restore.sh $BACKUP_DIR"

# Save a manifest of what was backed up
echo "$BACKUP_DIR" > /tmp/armoryvault-latest-backup-path
