#!/usr/bin/env zsh
export ANDROID_HOME="/usr/local/share/android-commandlinetools"
set -e

APK_PATH="android/app/build/outputs/apk/release/app-release.apk"

# Check if the GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) is not installed. Please install it first."
    exit 1
fi

# Extract version from package.json
VERSION=$(node -p "require('./package.json').version")

if [ -z "$VERSION" ]; then
    echo "Error: Could not read version from package.json"
    exit 1
fi

DIR="$(cd "$(dirname "$0")" && pwd)"
export CMAKE_BUILD_PARALLEL_LEVEL=$(sysctl -n hw.ncpu 2>/dev/null || echo 8)
pushd "$DIR/android" > /dev/null
./gradlew assembleRelease --parallel --build-cache --max-workers=8
popd > /dev/null

if [ ! -f "$APK_PATH" ]; then
    echo "Error: Release APK not found at $APK_PATH even after building."
    exit 1
fi

# Extract release notes from CHANGELOG.md
NOTES_FILE=$(mktemp)
if [ -f "CHANGELOG.md" ]; then
    awk -v ver="\\[$VERSION\\]" '
      /^## \[/ {
        if (in_version) { exit }
        if (index($0, ver) > 0) { in_version=1; next }
      }
      in_version { print }
    ' CHANGELOG.md > "$NOTES_FILE"
fi

echo "Publishing APK to GitHub Release v$VERSION..."

# Ensure the tag is pushed to the remote if it exists locally
if git rev-parse "v$VERSION" >/dev/null 2>&1; then
    echo "Pushing tag v$VERSION to remote..."
    git push origin "v$VERSION" || true
fi

# Strip trailing/leading blank lines checking if empty
if [ -s "$NOTES_FILE" ] && [ "$(awk 'NF' "$NOTES_FILE" | wc -l | tr -d ' ')" -gt 0 ]; then
    echo "Found changelog notes for v$VERSION. Using them for the release."
    gh release create "v$VERSION" "$APK_PATH" \
        --title "Release v$VERSION" \
        --notes-file "$NOTES_FILE"
else
    echo "No changelog notes found for v$VERSION. Auto-generating notes."
    gh release create "v$VERSION" "$APK_PATH" \
        --title "Release v$VERSION" \
        --generate-notes
fi

rm -f "$NOTES_FILE"

echo "✅ Successfully published Release v$VERSION to GitHub!"
