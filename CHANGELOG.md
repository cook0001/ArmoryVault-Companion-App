# Changelog

## [2.6.0] - 2026-08-22
### Added
- **Air-Gapped Bench Voice Memos (`/voice-memos`)**: Native offline voice memo recorder using `expo-audio` SDK 57 engine with live audio waveform visualizers, firearm/lot tagging, and scoped local storage for capturing reloading notes and range thoughts hands-free.
- **Floating Tactical Bottom Navigation (`BottomTabBar.tsx`)**: High-contrast, non-overlapping floating glassmorphism tab bar providing instant navigation across Home, Scanner, Vault, Ammo, and Outbox with zero element occlusion.
- **Multi-Unit Barcode & Ammo Packaging Scanner (`/scanner`)**: Upgraded barcode scanner supporting custom package multipliers (`Boxes × Rounds/Box`), quick presets (20, 25, 50, 100, 250, 500, 1000 rds), packaging unit tags (`BOX`, `CAN`, `CASE`, `BRICK`), and instant inventory search drawer.
- **Solid Tactical UI & Full-Width Dialog Standard**: Replaced default system dialogues with centered full-width modal dialogs (`DialogContext.tsx`) for destructive confirmations, sync prompts, and toast notifications.
- **Strict Custom & Vector Icon Standard (Rule 7)**: Banned raw emoji placeholders across all screens in favor of dedicated themed vector icon components (`CartridgesIcon`, `GunpowderIcon`, `SafeIcon`, `Ionicons`).
- **Android Native VersionCode Monotonic Standard (Rule 8)**: Baseline `versionCode >= 300` established (versionCode 300, maintained at exactly one code version below Nightly build 301) to guarantee clean, error-free OTA updates via the in-app updater.

## [2.5.1] - 2026-08-19
### Fixed
- **Resilient Offline Cache & Network Handling**: Fixed noisy `java.net.ConnectException` and `CodedError` exceptions appearing on startup and screen focus when the desktop companion server is unreachable. Network pings and cache checks now use `AbortController` timeouts (2.5-4s) and gate background sync requests so the companion app transitions seamlessly and quietly into Offline Cache Mode.
- **Graceful Refresh Handling**: Added network timeouts and graceful offline warning handlers to manual pull-to-refresh on Firearms, Inventory, and Settings screens.
- **Silent Startup Update Check**: Prevented console errors when the automatic GitHub update check runs while device is offline.

## [2.5.0] - 2026-08-16
### Added
- **Modern Dashboard & Action Hub**: Overhauled the mobile home screen with a real-time desktop connection beacon, hero sync card with pending counter, and a 4-card Quick Action Hub (`Universal Scan`, `Range Mode`, `Firearms Vault`, `Ammo & Supplies`).
- **Offline Firearms Vault Browser (`/firearms`)**: Searchable offline catalog of all firearms in your vault with total rounds fired, caliber badges, and quick-action buttons to log range trips or inspections.
- **Offline Ammo & Reloading Inventory Catalog (`/inventory`)**: Dual-tab inventory browser for Ammunition and Reloading Supplies with search, category filtering (Powder, Primer, Case, Bullet), and instant stock adjustment modals.
- **Dedicated Range Mode Companion (`/range`)**: Fast range session logger with firearm selector, auto-filtered caliber ammo deduction, fast-tap round presets (+25, +50, +100, +200), target photo capture, and session notes.
- **Enhanced Settings & Sync Tools**: Added manual IP entry with connection ping test, forced cache refresh, and local storage diagnostic metrics.
- **Reloading Component Tailored Steppers**: Added unit-aware quantity steppers for powder (lbs) and primers/brass/bullets (counts).

## [2.4.0] - 2026-08-16
### Added
- **Full Offline Inventory Cache Integration (`/api/inventory/cache`)**: When connected to the desktop vault, the mobile app automatically downloads and caches firearms, ammunition, reloading components, and the custom SKU dictionary for complete offline functionality at the shooting range.
- **High-Density QR Code Protocol Support**: Added recognition for `AV-AMMO-<id>`, `AV-FIREARM-<id>`, and `AV-COMP-<id>` QR codes printed on ammo cans and box labels for instant mobile scanning and quantity adjustments.
- **Smart Range Session Logging with Caliber Ammo Deductions**: Upgraded the firearm range logger to allow selecting caliber-matched ammunition from the offline cache, automatically queuing `range_session` actions to sync with the desktop's atomic inventory session ledger.
- **Enhanced Scanner & Quantity Steppers**: Added item preview badges showing current on-hand stock and quick steppers (+20, +50, +100, +250, +500, +1400) for rapid inventory audits.
- **Outbox Range Session Management**: View, modify rounds fired, and review pending range sessions and universal scans directly in the offline outbox.

## [2.3.4] - 2026-08-16
### Fixed
- Fixed an auto-updater crash where consecutive downloads failed with a "Destination already exists" error by appending unique timestamps to the temporary APK filename.

## [2.3.3] - 2026-08-16
### Changed
- Dry run version bump to test the new in-app APK auto-updater mechanism.

## [2.3.2] - 2026-08-16
### Fixed
- Completely migrated APK auto-updater from the deprecated `downloadAsync` legacy API to the modern `File.downloadFileAsync` API from Expo SDK 57 to resolve the persist deprecation crash on Android.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.3.1] - 2026-08-16

### Fixed
- **In-App Updater:** Fixed an issue on Android where the package installer intent would fail to launch when updating the APK from within the app.
- **Release Script:** Automated pushing local tags to the remote repository before attempting to create a GitHub release.

## [2.3.0] - 2026-08-16

### Changed
- Version bump and GitHub Release pipeline integration.

## [2.2.19] - 2026-08-16

### Added
- **Detailed Sync Error Reporting:** Added specific alert dialogues that help diagnose network timeouts, server errors (404/500), and unreachable IP addresses when trying to sync with the desktop vault.
- **In-App Updater:** Added support for GitHub auto-updating for future APK releases.

### Fixed
- **Android APK Syncing:** Fixed an issue where standalone Android APK builds were silently blocking local network HTTP traffic (`usesCleartextTraffic`), which prevented the mobile app from connecting to the desktop server.
- **iOS Local Network Syncing:** Enabled `NSAllowsArbitraryLoads` to ensure iOS devices can properly communicate with the desktop application on local Wi-Fi.

### Added
- **Dynamic Measurement UI**: Scan modal now prompts for exact measurement unit (e.g. `box`, `rds`, `lbs`, `brick`) and relays selection directly to Desktop Sync Inbox.
- **Smart Prompts**: Scanner now automatically triggers an interactive quantity prompt for all Universal Scans.

### Changed
- Removed deprecated Ammo/Component classification guessing from mobile app. All unrecognized barcodes are now queued as Universal Scans and handled by the Desktop.
