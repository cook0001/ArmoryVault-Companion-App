#!/usr/bin/env zsh
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Accept a backup directory, or use the latest one
BACKUP_DIR="${1:-$(cat /tmp/armoryvault-latest-backup-path 2>/dev/null || echo "")}"

if [ -z "$BACKUP_DIR" ] || [ ! -d "$BACKUP_DIR" ]; then
  echo "Usage: ./native-restore.sh <backup-directory>"
  echo ""
  echo "Available backups:"
  ls -dt /tmp/armoryvault-native-snapshot-* 2>/dev/null | head -5 || echo "  (none found)"
  exit 1
fi

echo "=========================================================="
echo "  ArmoryVault Companion — Native Restore"
echo "  From: $BACKUP_DIR"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================================="
echo ""

FILES_RESTORED=0

restore_file() {
  local src="$BACKUP_DIR/$1"
  local dest="$2"
  if [ -f "$src" ]; then
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
    echo "   ✅ → $dest"
    FILES_RESTORED=$((FILES_RESTORED + 1))
  fi
}

restore_dir() {
  local src="$BACKUP_DIR/$1"
  local dest="$2"
  if [ -d "$src" ]; then
    mkdir -p "$(dirname "$dest")"
    cp -r "$src" "$dest"
    echo "   ✅ → $dest/"
    FILES_RESTORED=$((FILES_RESTORED + 1))
  fi
}

echo "📁 Restoring native files..."
echo ""

# Gradle config
restore_file "build.gradle" "android/app/build.gradle"
restore_file "gradle.properties" "android/gradle.properties"
restore_file "root-build.gradle" "android/build.gradle"
restore_file "settings.gradle" "android/settings.gradle"

# App manifest & ProGuard
restore_file "AndroidManifest.xml" "android/app/src/main/AndroidManifest.xml"
restore_file "proguard-rules.pro" "android/app/proguard-rules.pro"

# Kotlin source
restore_file "MainActivity.kt" "android/app/src/main/java/com/armoryvault/companion/MainActivity.kt"
restore_file "MainApplication.kt" "android/app/src/main/java/com/armoryvault/companion/MainApplication.kt"

# Resources
if [ -d "$BACKUP_DIR/res" ]; then
  rm -rf android/app/src/main/res
  restore_dir "res" "android/app/src/main/res"
fi

# Keystore
restore_file "debug.keystore" "android/app/debug.keystore"

echo ""
echo "=========================================================="
echo "  ✅ Restored $FILES_RESTORED items from backup"
echo "=========================================================="
echo ""
echo "Run ./clean-build.sh to rebuild with restored native files."
