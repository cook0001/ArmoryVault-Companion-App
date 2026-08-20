#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  ArmoryVault Companion — Device Crash Diagnostics
#  Captures crash logs, ANRs, and system info from a connected
#  Android device via ADB.
#
#  Usage:
#    ./crash-report.sh              # Capture crash from fresh launch
#    ./crash-report.sh --history    # Dump recent crash history (no relaunch)
#    ./crash-report.sh --live       # Live tail logcat (Ctrl+C to stop)
# ══════════════════════════════════════════════════════════════

set -euo pipefail

PACKAGE="com.armoryvault.companion"
ACTIVITY=".MainActivity"
ANDROID_HOME="${ANDROID_HOME:-/usr/local/share/android-commandlinetools}"
ADB="$ANDROID_HOME/platform-tools/adb"
REPORT_DIR="crash-reports"
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
REPORT_FILE="$REPORT_DIR/crash_${TIMESTAMP}.txt"

# ─── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

header() { echo -e "\n${CYAN}${BOLD}═══ $1 ═══${NC}"; }
ok()     { echo -e "   ${GREEN}✅ $1${NC}"; }
warn()   { echo -e "   ${YELLOW}⚠️  $1${NC}"; }
fail()   { echo -e "   ${RED}❌ $1${NC}"; }
info()   { echo -e "   ${CYAN}ℹ️  $1${NC}"; }

# ─── Preflight ───────────────────────────────────────────────
if ! command -v "$ADB" &>/dev/null; then
  fail "adb not found at $ADB"
  echo "   Set ANDROID_HOME or install Android platform-tools."
  exit 1
fi

DEVICE_COUNT=$("$ADB" devices 2>/dev/null | grep -c "device$" || true)
if [ "${DEVICE_COUNT:-0}" -eq 0 ]; then
  fail "No device connected!"
  echo ""
  echo "   1. Connect your phone via USB"
  echo "   2. Enable USB Debugging in Developer Options"
  echo "   3. Accept the debug authorization prompt on your phone"
  echo "   4. Run this script again"
  exit 1
fi

DEVICE_MODEL=$("$ADB" shell getprop ro.product.model 2>/dev/null | tr -d '\r')
DEVICE_ANDROID=$("$ADB" shell getprop ro.build.version.release 2>/dev/null | tr -d '\r')
DEVICE_SDK=$("$ADB" shell getprop ro.build.version.sdk 2>/dev/null | tr -d '\r')
DEVICE_SERIAL=$("$ADB" get-serialno 2>/dev/null | tr -d '\r')

mkdir -p "$REPORT_DIR"

echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
echo -e "  ${BOLD}ArmoryVault Companion — Crash Diagnostics${NC}"
echo -e "  Device:  ${CYAN}${DEVICE_MODEL}${NC} (Android ${DEVICE_ANDROID}, SDK ${DEVICE_SDK})"
echo -e "  Serial:  ${DEVICE_SERIAL}"
echo -e "  Report:  ${REPORT_FILE}"
echo -e "  Time:    ${TIMESTAMP}"
echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"

# ─── Mode: --live ────────────────────────────────────────────
if [[ "${1:-}" == "--live" ]]; then
  header "Live Logcat (Ctrl+C to stop)"
  info "Filtering for $PACKAGE"
  echo ""
  "$ADB" logcat -v time --pid=$("$ADB" shell pidof "$PACKAGE" 2>/dev/null || echo "0") \
    AndroidRuntime:E System.err:W ExpoModulesCore:E ReactNativeJS:E "*:S" 2>/dev/null || \
    "$ADB" logcat -v time -s AndroidRuntime:E ReactNativeJS:E ExpoModulesCore:E
  exit 0
fi

# ─── Begin Report ────────────────────────────────────────────
{
  echo "═══════════════════════════════════════════════════════"
  echo "  ArmoryVault Companion — Crash Report"
  echo "  Generated: $(date)"
  echo "═══════════════════════════════════════════════════════"
  echo ""
  echo "DEVICE INFO"
  echo "  Model:      $DEVICE_MODEL"
  echo "  Android:    $DEVICE_ANDROID (SDK $DEVICE_SDK)"
  echo "  Serial:     $DEVICE_SERIAL"
  echo "  ABI:        $("$ADB" shell getprop ro.product.cpu.abi 2>/dev/null | tr -d '\r')"
  echo "  RAM:        $("$ADB" shell cat /proc/meminfo 2>/dev/null | head -1 | tr -d '\r')"
  echo ""

  # App version from the device
  echo "APP INFO"
  APP_VERSION=$("$ADB" shell dumpsys package "$PACKAGE" 2>/dev/null | grep "versionName" | head -1 | sed 's/.*versionName=/  Version:    /' | tr -d '\r')
  APP_CODE=$("$ADB" shell dumpsys package "$PACKAGE" 2>/dev/null | grep "versionCode" | head -1 | sed 's/.*versionCode=/  Code:       /' | tr -d '\r')
  echo "${APP_VERSION:-  Version:    (not installed)}"
  echo "${APP_CODE:-  Code:       (not installed)}"
  echo "  Package:    $PACKAGE"
  echo ""
} > "$REPORT_FILE"

# ─── Mode: --history (no relaunch) ───────────────────────────
if [[ "${1:-}" == "--history" ]]; then
  header "Crash History (no app relaunch)"

  {
    echo "═══ RECENT CRASH LOGS ═══"
    echo ""
    "$ADB" logcat -d -s AndroidRuntime:E 2>/dev/null | grep -A 50 "$PACKAGE" | tail -100
    echo ""
    echo "═══ RECENT ANR TRACES ═══"
    echo ""
    "$ADB" shell "cat /data/anr/traces.txt 2>/dev/null | head -100" 2>/dev/null || echo "(no ANR traces available)"
    echo ""
    echo "═══ TOMBSTONES ═══"
    echo ""
    "$ADB" shell "ls -la /data/tombstones/ 2>/dev/null" || echo "(no tombstones available)"
  } >> "$REPORT_FILE"

  ok "Crash history saved to $REPORT_FILE"
  echo ""

  # Print summary to terminal
  CRASH_COUNT=$("$ADB" logcat -d -s AndroidRuntime:E 2>/dev/null | grep -c "FATAL EXCEPTION" || true)
  if [ "${CRASH_COUNT:-0}" -gt 0 ]; then
    fail "Found $CRASH_COUNT crash(es) in logcat buffer"
    echo ""
    echo -e "${RED}${BOLD}Last crash:${NC}"
    "$ADB" logcat -d -s AndroidRuntime:E 2>/dev/null | grep -A 5 "FATAL EXCEPTION" | tail -6
  else
    ok "No crashes in current logcat buffer"
  fi
  exit 0
fi

# ─── Mode: Default (fresh launch + capture) ──────────────────
header "Step 1: Clearing logcat buffer"
"$ADB" logcat -c
ok "Logcat buffer cleared"

header "Step 2: Force-stopping app"
"$ADB" shell am force-stop "$PACKAGE" 2>/dev/null
ok "App stopped"

header "Step 3: Launching app"
"$ADB" shell am start -n "$PACKAGE/$ACTIVITY" 2>/dev/null
info "Waiting 5 seconds for app to start (or crash)..."
sleep 5

header "Step 4: Analyzing logs"

# Check if app is still running
APP_PID=$("$ADB" shell pidof "$PACKAGE" 2>/dev/null | tr -d '\r' || true)
CRASH_LOG=$("$ADB" logcat -d -s AndroidRuntime:E 2>&1)
CRASH_COUNT=$(echo "$CRASH_LOG" | grep -c "FATAL EXCEPTION" || true)

{
  echo "═══ LAUNCH RESULT ═══"
  echo ""
  if [ "${CRASH_COUNT:-0}" -gt 0 ]; then
    echo "STATUS: ❌ CRASHED"
    echo "PID:    (dead)"
  else
    echo "STATUS: ✅ RUNNING"
    echo "PID:    ${APP_PID:-unknown}"
  fi
  echo ""

  echo "═══ FATAL EXCEPTIONS (AndroidRuntime) ═══"
  echo ""
  echo "$CRASH_LOG"
  echo ""

  echo "═══ REACT NATIVE JS ERRORS ═══"
  echo ""
  "$ADB" logcat -d -s ReactNativeJS:E 2>/dev/null | tail -30
  echo ""

  echo "═══ EXPO MODULE ERRORS ═══"
  echo ""
  "$ADB" logcat -d -s ExpoModulesCore:E 2>/dev/null | tail -20
  echo ""

  echo "═══ ACTIVITY MANAGER WARNINGS ═══"
  echo ""
  "$ADB" logcat -d -s ActivityManager:W 2>/dev/null | grep "$PACKAGE" | tail -10
  echo ""

  echo "═══ FULL APP LOGCAT (last 200 lines) ═══"
  echo ""
  if [ -n "${APP_PID:-}" ] && [ "$APP_PID" != "" ]; then
    "$ADB" logcat -d --pid="$APP_PID" 2>/dev/null | tail -200
  else
    "$ADB" logcat -d 2>/dev/null | grep "$PACKAGE" | tail -200
  fi
} >> "$REPORT_FILE"

# ─── Summary ─────────────────────────────────────────────────
echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
echo -e "  ${BOLD}Crash Report Summary${NC}"
echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"

if [ "${CRASH_COUNT:-0}" -gt 0 ]; then
  fail "APP CRASHED on launch!"
  echo ""
  echo -e "  ${BOLD}Exception:${NC}"
  echo "$CRASH_LOG" | grep "FATAL EXCEPTION" | head -1 | sed 's/^/   /'
  echo ""
  echo -e "  ${BOLD}Root cause:${NC}"
  echo "$CRASH_LOG" | grep -E "Caused by:|Error:|Exception:" | head -3 | sed 's/^/   /'
  echo ""
  echo -e "  ${BOLD}Crash in:${NC}"
  echo "$CRASH_LOG" | grep "at " | head -3 | sed 's/^/   /'
else
  ok "App launched successfully (PID: ${APP_PID:-unknown})"
  JS_ERRORS=$("$ADB" logcat -d -s ReactNativeJS:E 2>/dev/null | wc -l | tr -d ' ')
  if [ "${JS_ERRORS:-0}" -gt 0 ]; then
    warn "$JS_ERRORS JS-level error(s) detected (non-fatal)"
  fi
fi

echo ""
echo -e "  📄 Full report: ${CYAN}${REPORT_FILE}${NC}"
echo -e "  📊 Report size: $(wc -c < "$REPORT_FILE" | tr -d ' ') bytes"
echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
echo ""
