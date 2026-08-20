#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  ArmoryVault Companion — Feature Debug Inspector
#  Diagnoses why a specific feature isn't working on-device.
#  Checks permissions, hardware, storage, network, and logs.
#
#  Usage:
#    ./debug-feature.sh                # Interactive menu
#    ./debug-feature.sh camera         # Debug camera/barcode scanner
#    ./debug-feature.sh sync           # Debug Wi-Fi sync
#    ./debug-feature.sh storage        # Debug storage/cache
#    ./debug-feature.sh biometrics     # Debug fingerprint/face unlock
#    ./debug-feature.sh notifications  # Debug notifications
#    ./debug-feature.sh all            # Run ALL diagnostics
# ══════════════════════════════════════════════════════════════

set -uo pipefail
# NOTE: We intentionally do NOT use set -e here. Diagnostic scripts should
# run all checks even if individual ADB queries return non-zero exit codes.

PACKAGE="com.armoryvault.companion"
ANDROID_HOME="${ANDROID_HOME:-/usr/local/share/android-commandlinetools}"
ADB="$ANDROID_HOME/platform-tools/adb"
REPORT_DIR="debug-reports"
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")

# ─── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

ok()     { echo -e "   ${GREEN}✅ $1${NC}"; }
warn()   { echo -e "   ${YELLOW}⚠️  $1${NC}"; }
fail()   { echo -e "   ${RED}❌ $1${NC}"; }
info()   { echo -e "   ${CYAN}ℹ️  $1${NC}"; }
header() { echo -e "\n${CYAN}${BOLD}───── $1 ─────${NC}"; }
divider(){ echo -e "${DIM}──────────────────────────────────────────────${NC}"; }

# ─── Preflight ───────────────────────────────────────────────
preflight() {
  if ! command -v "$ADB" &>/dev/null; then
    fail "adb not found at $ADB"
    exit 1
  fi

  DEVICE_COUNT=$("$ADB" devices 2>/dev/null | grep -c "device$" || true)
  if [ "${DEVICE_COUNT:-0}" -eq 0 ]; then
    fail "No device connected. Plug in your phone with USB Debugging enabled."
    exit 1
  fi

  # Check app is installed
  if ! "$ADB" shell pm list packages 2>/dev/null | grep -q "$PACKAGE"; then
    fail "$PACKAGE is not installed on this device."
    exit 1
  fi

  DEVICE_MODEL=$("$ADB" shell getprop ro.product.model 2>/dev/null | tr -d '\r')
  DEVICE_ANDROID=$("$ADB" shell getprop ro.build.version.release 2>/dev/null | tr -d '\r')
  DEVICE_SDK=$("$ADB" shell getprop ro.build.version.sdk 2>/dev/null | tr -d '\r')
  APP_VERSION=$("$ADB" shell dumpsys package "$PACKAGE" 2>/dev/null | grep "versionName" | head -1 | awk -F= '{print $2}' | tr -d '\r')

  mkdir -p "$REPORT_DIR"
  REPORT_FILE="$REPORT_DIR/debug_${1:-all}_${TIMESTAMP}.txt"

  echo ""
  echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
  echo -e "  ${BOLD}ArmoryVault Companion — Feature Debugger${NC}"
  echo -e "  Device:  ${CYAN}${DEVICE_MODEL}${NC} · Android ${DEVICE_ANDROID} (SDK ${DEVICE_SDK})"
  echo -e "  App:     v${APP_VERSION}"
  echo -e "  Report:  ${REPORT_FILE}"
  echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
}

# ─── Permission Checker ──────────────────────────────────────
check_permission() {
  local perm="$1"
  local label="$2"
  local result
  result=$("$ADB" shell dumpsys package "$PACKAGE" 2>/dev/null | grep "$perm" | head -1 || true)

  if echo "$result" | grep -q "granted=true"; then
    ok "$label: GRANTED"
    echo "  GRANTED  $label ($perm)" >> "$REPORT_FILE"
    return 0
  else
    fail "$label: DENIED"
    echo "  DENIED   $label ($perm)" >> "$REPORT_FILE"
    echo -e "   ${DIM}Fix: Open Settings → Apps → ArmoryVault → Permissions → Enable ${label}${NC}"
    return 1
  fi
}

# ═══════════════════════════════════════════════════════════════
#  FEATURE: Camera & Barcode Scanner
# ═══════════════════════════════════════════════════════════════
debug_camera() {
  header "Camera & Barcode Scanner"
  echo "" >> "$REPORT_FILE"
  echo "═══ CAMERA & BARCODE SCANNER ═══" >> "$REPORT_FILE"

  # Permissions
  echo -e "\n  ${BOLD}Permissions:${NC}"
  check_permission "android.permission.CAMERA" "Camera" || true

  # Camera hardware
  echo -e "\n  ${BOLD}Hardware:${NC}"
  CAM_COUNT=$("$ADB" shell "dumpsys media.camera 2>/dev/null | grep -c 'Camera ID'" 2>/dev/null | tr -dc '0-9' || true)
  CAM_COUNT="${CAM_COUNT:-0}"
  if [ "$CAM_COUNT" -gt 0 ] 2>/dev/null; then
    ok "Camera hardware detected ($CAM_COUNT camera(s))"
  else
    warn "Could not detect camera hardware (may need root)"
  fi

  # Check if another app is using the camera
  CAM_ACTIVE=$("$ADB" shell "dumpsys media.camera 2>/dev/null | grep 'Active Camera'" 2>/dev/null || true)
  if [ -n "$CAM_ACTIVE" ] && ! echo "$CAM_ACTIVE" | grep -q "none"; then
    warn "Camera may be in use by another app"
    echo "   $CAM_ACTIVE" | sed 's/^/   /'
  else
    ok "Camera is not locked by another app"
  fi

  # Camera-related logcat errors
  echo -e "\n  ${BOLD}Recent Errors:${NC}"
  CAM_ERRORS=$("$ADB" logcat -d 2>/dev/null | grep -iE "camera|barcode|scanner" | grep -iE "error|fail|exception|denied" | tail -5)
  if [ -n "$CAM_ERRORS" ]; then
    warn "Camera-related errors found:"
    echo "$CAM_ERRORS" | while read -r line; do echo -e "   ${DIM}$line${NC}"; done
    echo "$CAM_ERRORS" >> "$REPORT_FILE"
  else
    ok "No camera errors in recent logs"
  fi
}

# ═══════════════════════════════════════════════════════════════
#  FEATURE: Wi-Fi Sync
# ═══════════════════════════════════════════════════════════════
debug_sync() {
  header "Wi-Fi Sync (Desktop Companion)"
  echo "" >> "$REPORT_FILE"
  echo "═══ WI-FI SYNC ═══" >> "$REPORT_FILE"

  # Network state
  echo -e "\n  ${BOLD}Network:${NC}"
  WIFI_STATE=$("$ADB" shell dumpsys wifi 2>/dev/null | grep "Wi-Fi is" | head -1 | tr -d '\r')
  if echo "$WIFI_STATE" | grep -qi "enabled"; then
    ok "Wi-Fi is enabled"
  else
    fail "Wi-Fi is DISABLED"
    echo -e "   ${DIM}Fix: Enable Wi-Fi on your device${NC}"
  fi

  WIFI_SSID=$("$ADB" shell dumpsys netstats 2>/dev/null | grep -i "networkId" | head -1 | tr -d '\r' || true)
  WIFI_IP=$("$ADB" shell ip addr show wlan0 2>/dev/null | grep "inet " | awk '{print $2}' | tr -d '\r' || true)
  if [ -n "$WIFI_IP" ]; then
    ok "Connected to Wi-Fi (IP: ${WIFI_IP})"
    echo "  Wi-Fi IP: $WIFI_IP" >> "$REPORT_FILE"
  else
    fail "Not connected to Wi-Fi"
  fi

  # Cleartext traffic
  echo -e "\n  ${BOLD}Cleartext HTTP:${NC}"
  CLEARTEXT_CHECK=$("$ADB" shell "cat /data/app/*${PACKAGE}*/base.apk 2>/dev/null" 2>/dev/null | strings 2>/dev/null | grep -i "cleartextTraffic" || true)
  MANIFEST_DUMP=$("$ADB" shell dumpsys package "$PACKAGE" 2>/dev/null || true)
  # Also check via the flags field
  NET_SEC=$(echo "$MANIFEST_DUMP" | grep -i "networkSecurityConfig\|usesCleartext\|flag.*CLEARTEXT" || true)
  # Check if the local AndroidManifest has it
  LOCAL_CHECK=""
  if [ -f "android/app/src/main/AndroidManifest.xml" ]; then
    LOCAL_CHECK=$(grep -i "usesCleartextTraffic" android/app/src/main/AndroidManifest.xml 2>/dev/null || true)
  fi
  if [ -n "$LOCAL_CHECK" ] && echo "$LOCAL_CHECK" | grep -qi "true"; then
    ok "Cleartext traffic is ALLOWED in local AndroidManifest.xml"
  elif [ -n "$NET_SEC" ]; then
    info "Network security config present: $(echo "$NET_SEC" | head -1 | tr -d '\r')"
  else
    warn "Could not verify cleartext traffic setting"
    echo -e "   ${DIM}AndroidManifest.xml should have: usesCleartextTraffic=\"true\"${NC}"
  fi

  # Network permissions (these are normal/install-time permissions, not runtime)
  echo -e "\n  ${BOLD}Permissions:${NC}"
  REQUESTED_PERMS=$("$ADB" shell dumpsys package "$PACKAGE" 2>/dev/null | grep -E "android.permission\.(INTERNET|ACCESS_NETWORK_STATE|ACCESS_WIFI_STATE)" || true)
  for perm_name in INTERNET ACCESS_NETWORK_STATE ACCESS_WIFI_STATE; do
    if echo "$REQUESTED_PERMS" | grep -q "$perm_name"; then
      ok "$perm_name: DECLARED (auto-granted at install)"
      echo "  DECLARED $perm_name" >> "$REPORT_FILE"
    else
      fail "$perm_name: NOT DECLARED in manifest"
      echo "  MISSING  $perm_name" >> "$REPORT_FILE"
    fi
  done

  # Port check
  echo -e "\n  ${BOLD}Connectivity:${NC}"
  SAVED_IP=$("$ADB" shell "run-as $PACKAGE cat /data/data/$PACKAGE/shared_prefs/RN_AsyncStorage.xml 2>/dev/null" 2>/dev/null | grep "server_ip" | sed 's/.*>//' | sed 's/<.*//' | tr -d '\r' || true)
  if [ -n "$SAVED_IP" ]; then
    info "Saved server IP: $SAVED_IP"
    echo "  Saved server IP: $SAVED_IP" >> "$REPORT_FILE"
    # Try to reach the desktop server
    PING_RESULT=$("$ADB" shell "ping -c 1 -W 2 $SAVED_IP 2>/dev/null" 2>/dev/null | tail -1 || true)
    if echo "$PING_RESULT" | grep -q "1 received"; then
      ok "Desktop server is reachable"
    else
      fail "Cannot reach desktop server at $SAVED_IP"
      echo -e "   ${DIM}Ensure desktop app is running and both devices are on the same Wi-Fi${NC}"
    fi
  else
    info "No server IP configured yet (pair from Settings)"
  fi

  # Sync-related errors
  echo -e "\n  ${BOLD}Recent Errors:${NC}"
  SYNC_ERRORS=$("$ADB" logcat -d 2>/dev/null | grep -iE "sync|fetch|network|connect|socket|http" | grep -iE "error|fail|exception|timeout|refused" | grep -i "$PACKAGE" | tail -5)
  if [ -n "$SYNC_ERRORS" ]; then
    warn "Sync-related errors found:"
    echo "$SYNC_ERRORS" | while read -r line; do echo -e "   ${DIM}$line${NC}"; done
    echo "$SYNC_ERRORS" >> "$REPORT_FILE"
  else
    ok "No sync errors in recent logs"
  fi
}

# ═══════════════════════════════════════════════════════════════
#  FEATURE: Storage & Cache
# ═══════════════════════════════════════════════════════════════
debug_storage() {
  header "Storage & Cache"
  echo "" >> "$REPORT_FILE"
  echo "═══ STORAGE & CACHE ═══" >> "$REPORT_FILE"

  # App storage usage
  echo -e "\n  ${BOLD}App Storage:${NC}"
  STORAGE_INFO=$("$ADB" shell dumpsys diskstats 2>/dev/null | head -5 || true)
  APP_SIZE=$("$ADB" shell du -sh "/data/data/$PACKAGE" 2>/dev/null | awk '{print $1}' || echo "?")
  APP_CACHE=$("$ADB" shell du -sh "/data/data/$PACKAGE/cache" 2>/dev/null | awk '{print $1}' || echo "?")
  info "App data: ${APP_SIZE}"
  info "App cache: ${APP_CACHE}"
  echo "  App data size: $APP_SIZE" >> "$REPORT_FILE"
  echo "  App cache size: $APP_CACHE" >> "$REPORT_FILE"

  # Device free space
  DEVICE_FREE=$("$ADB" shell df /data 2>/dev/null | tail -1 | awk '{print $4}' || echo "?")
  if [ "$DEVICE_FREE" != "?" ]; then
    FREE_MB=$((DEVICE_FREE / 1024))
    if [ "$FREE_MB" -lt 100 ]; then
      fail "Device storage critically low: ${FREE_MB}MB free"
    elif [ "$FREE_MB" -lt 500 ]; then
      warn "Device storage low: ${FREE_MB}MB free"
    else
      ok "Device storage healthy: ${FREE_MB}MB free"
    fi
    echo "  Free space: ${FREE_MB}MB" >> "$REPORT_FILE"
  fi

  # AsyncStorage / SharedPreferences
  echo -e "\n  ${BOLD}AsyncStorage:${NC}"
  ASYNC_KEYS=$("$ADB" shell "run-as $PACKAGE cat /data/data/$PACKAGE/shared_prefs/RN_AsyncStorage.xml 2>/dev/null" 2>/dev/null | grep "<string name=" | sed 's/.*name="//' | sed 's/".*//' || true)
  if [ -n "$ASYNC_KEYS" ]; then
    KEY_COUNT=$(echo "$ASYNC_KEYS" | wc -l | tr -d ' ')
    ok "AsyncStorage has $KEY_COUNT key(s)"
    echo -e "   ${DIM}Keys: $(echo "$ASYNC_KEYS" | tr '\n' ', ' | sed 's/,$//')${NC}"
    echo "  AsyncStorage keys ($KEY_COUNT): $(echo "$ASYNC_KEYS" | tr '\n' ', ')" >> "$REPORT_FILE"
  else
    warn "AsyncStorage is empty or inaccessible"
    echo -e "   ${DIM}This is normal on first launch or after a data clear${NC}"
  fi

  # File system permissions
  echo -e "\n  ${BOLD}Permissions:${NC}"
  check_permission "android.permission.READ_EXTERNAL_STORAGE" "Read Storage" || true
  check_permission "android.permission.WRITE_EXTERNAL_STORAGE" "Write Storage" || true
}

# ═══════════════════════════════════════════════════════════════
#  FEATURE: Biometrics / Local Authentication
# ═══════════════════════════════════════════════════════════════
debug_biometrics() {
  header "Biometrics & Device Lock"
  echo "" >> "$REPORT_FILE"
  echo "═══ BIOMETRICS ═══" >> "$REPORT_FILE"

  # Hardware support
  echo -e "\n  ${BOLD}Hardware:${NC}"
  FINGERPRINT=$("$ADB" shell pm list features 2>/dev/null | grep "fingerprint" || true)
  FACE=$("$ADB" shell pm list features 2>/dev/null | grep "face" || true)
  IRIS=$("$ADB" shell pm list features 2>/dev/null | grep "iris" || true)

  if [ -n "$FINGERPRINT" ]; then
    ok "Fingerprint sensor available"
  else
    warn "No fingerprint sensor detected"
  fi
  if [ -n "$FACE" ]; then
    ok "Face recognition available"
  else
    info "No face recognition hardware"
  fi

  # Enrolled biometrics
  echo -e "\n  ${BOLD}Enrollment:${NC}"
  BIO_STATUS=$("$ADB" shell dumpsys fingerprint 2>/dev/null || true)
  ENROLLED=$(echo "$BIO_STATUS" | grep -i "enrolled\|fingerprints" | head -3 || true)
  if [ -n "$ENROLLED" ]; then
    echo "$ENROLLED" | while read -r line; do info "$(echo "$line" | tr -d '\r')"; done
  fi

  # Keyguard (screen lock)
  KEYGUARD=$("$ADB" shell dumpsys deviceidle 2>/dev/null | grep -i "mScreenLocked\|screenState" | head -2 || true)
  SECURE=$("$ADB" shell getprop ro.hardware.keystore 2>/dev/null | tr -d '\r' || true)
  LOCK_SET=$("$ADB" shell locksettings get-disabled 2>/dev/null | tr -d '\r' || true)
  info "Screen lock configured: ${LOCK_SET:-unknown}"

  # Permissions
  echo -e "\n  ${BOLD}Permissions:${NC}"
  check_permission "android.permission.USE_BIOMETRIC" "Biometric" || true
  check_permission "android.permission.USE_FINGERPRINT" "Fingerprint (legacy)" || true

  # Biometric errors
  echo -e "\n  ${BOLD}Recent Errors:${NC}"
  BIO_ERRORS=$("$ADB" logcat -d 2>/dev/null | grep -iE "biometric|fingerprint|authentication|keyguard|LocalAuthentication" | grep -iE "error|fail|exception|denied|cancel" | tail -5)
  if [ -n "$BIO_ERRORS" ]; then
    warn "Biometric errors found:"
    echo "$BIO_ERRORS" | while read -r line; do echo -e "   ${DIM}$line${NC}"; done
    echo "$BIO_ERRORS" >> "$REPORT_FILE"
  else
    ok "No biometric errors in recent logs"
  fi
}

# ═══════════════════════════════════════════════════════════════
#  FEATURE: Notifications
# ═══════════════════════════════════════════════════════════════
debug_notifications() {
  header "Notifications"
  echo "" >> "$REPORT_FILE"
  echo "═══ NOTIFICATIONS ═══" >> "$REPORT_FILE"

  echo -e "\n  ${BOLD}Status:${NC}"
  NOTIF_ENABLED=$("$ADB" shell dumpsys notification 2>/dev/null | grep -A5 "$PACKAGE" | head -10 || true)
  NOTIF_BLOCKED=$("$ADB" shell cmd appops get "$PACKAGE" POST_NOTIFICATION 2>/dev/null | tr -d '\r' || true)

  if echo "$NOTIF_BLOCKED" | grep -qi "allow"; then
    ok "Notifications are ALLOWED"
  elif echo "$NOTIF_BLOCKED" | grep -qi "deny\|ignore"; then
    fail "Notifications are BLOCKED"
    echo -e "   ${DIM}Fix: Settings → Apps → ArmoryVault → Notifications → Enable${NC}"
  else
    info "Notification status: $NOTIF_BLOCKED"
  fi

  # Permissions
  echo -e "\n  ${BOLD}Permissions:${NC}"
  check_permission "android.permission.POST_NOTIFICATIONS" "Post Notifications" || true

  # Battery optimization
  echo -e "\n  ${BOLD}Battery Optimization:${NC}"
  BATTERY_OPT=$("$ADB" shell dumpsys deviceidle whitelist 2>/dev/null | grep "$PACKAGE" || true)
  if [ -n "$BATTERY_OPT" ]; then
    ok "App is whitelisted from battery optimization"
  else
    warn "App may be battery-optimized (can delay/block background work)"
    echo -e "   ${DIM}Fix: Settings → Battery → Battery optimization → ArmoryVault → Don't optimize${NC}"
  fi
}

# ═══════════════════════════════════════════════════════════════
#  GLOBAL: JS Errors & React Native Logs
# ═══════════════════════════════════════════════════════════════
debug_js_errors() {
  header "React Native & JS Runtime"
  echo "" >> "$REPORT_FILE"
  echo "═══ JS RUNTIME ═══" >> "$REPORT_FILE"

  echo -e "\n  ${BOLD}JS Errors (non-fatal):${NC}"
  JS_ERRORS=$("$ADB" logcat -d -s ReactNativeJS:E 2>/dev/null | tail -15)
  if [ -n "$JS_ERRORS" ]; then
    JS_COUNT=$(echo "$JS_ERRORS" | wc -l | tr -d ' ')
    warn "$JS_COUNT JS error(s) in logcat:"
    echo "$JS_ERRORS" | while read -r line; do echo -e "   ${DIM}$line${NC}"; done
    echo "$JS_ERRORS" >> "$REPORT_FILE"
  else
    ok "No JS errors in logcat"
  fi

  echo -e "\n  ${BOLD}JS Warnings:${NC}"
  JS_WARNS=$("$ADB" logcat -d -s ReactNativeJS:W 2>/dev/null | tail -10)
  if [ -n "$JS_WARNS" ]; then
    JS_WARN_COUNT=$(echo "$JS_WARNS" | wc -l | tr -d ' ')
    info "$JS_WARN_COUNT JS warning(s) — usually non-critical"
  else
    ok "No JS warnings"
  fi

  echo -e "\n  ${BOLD}Expo Module Errors:${NC}"
  EXPO_ERRORS=$("$ADB" logcat -d 2>/dev/null | grep -iE "ExpoModule|expo\.modules" | grep -iE "error|exception|fail" | tail -10)
  if [ -n "$EXPO_ERRORS" ]; then
    warn "Expo module errors found:"
    echo "$EXPO_ERRORS" | while read -r line; do echo -e "   ${DIM}$line${NC}"; done
    echo "$EXPO_ERRORS" >> "$REPORT_FILE"
  else
    ok "No Expo module errors"
  fi
}

# ═══════════════════════════════════════════════════════════════
#  Interactive Menu
# ═══════════════════════════════════════════════════════════════
show_menu() {
  echo ""
  echo -e "${BOLD}Which feature do you want to debug?${NC}"
  echo ""
  echo "  1) 📷  Camera & Barcode Scanner"
  echo "  2) 🔄  Wi-Fi Sync (Desktop Companion)"
  echo "  3) 💾  Storage & Cache"
  echo "  4) 🔐  Biometrics & Device Lock"
  echo "  5) 🔔  Notifications"
  echo "  6) ⚛️   React Native & JS Runtime"
  echo "  7) 🔍  ALL (run everything)"
  echo ""
  read -rp "  Select (1-7): " choice

  case "$choice" in
    1) FEATURE="camera" ;;
    2) FEATURE="sync" ;;
    3) FEATURE="storage" ;;
    4) FEATURE="biometrics" ;;
    5) FEATURE="notifications" ;;
    6) FEATURE="js" ;;
    7) FEATURE="all" ;;
    *) echo "Invalid choice"; exit 1 ;;
  esac
}

# ═══════════════════════════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════════════════════════
FEATURE="${1:-menu}"

if [ "$FEATURE" = "menu" ]; then
  preflight "menu"
  show_menu
  REPORT_FILE="$REPORT_DIR/debug_${FEATURE}_${TIMESTAMP}.txt"
fi

if [ "$FEATURE" != "menu" ]; then
  preflight "$FEATURE"
fi

# Initialize report
{
  echo "═══════════════════════════════════════════════════════"
  echo "  ArmoryVault Companion — Feature Debug Report"
  echo "  Feature: $FEATURE"
  echo "  Generated: $(date)"
  echo "  Device: $DEVICE_MODEL (Android $DEVICE_ANDROID, SDK $DEVICE_SDK)"
  echo "  App Version: $APP_VERSION"
  echo "═══════════════════════════════════════════════════════"
} > "$REPORT_FILE"

case "$FEATURE" in
  camera)        debug_camera ;;
  sync)          debug_sync ;;
  storage)       debug_storage ;;
  biometrics)    debug_biometrics ;;
  notifications) debug_notifications ;;
  js)            debug_js_errors ;;
  all)
    debug_camera
    divider
    debug_sync
    divider
    debug_storage
    divider
    debug_biometrics
    divider
    debug_notifications
    divider
    debug_js_errors
    ;;
  *) fail "Unknown feature: $FEATURE"; exit 1 ;;
esac

# ─── Footer ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
echo -e "  📄 Full report saved: ${CYAN}${REPORT_FILE}${NC}"
echo -e "  📊 Report size: $(wc -c < "$REPORT_FILE" | tr -d ' ') bytes"
echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
echo ""
