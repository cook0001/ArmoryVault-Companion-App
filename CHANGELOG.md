# Changelog

## [2.6.0-nightly.3] - 2026-08-18 (Nightly Test Build)
### Added
- **Expanded Commercial Factory Caliber Database (35+ Standard Loads)**:
  - Full commercial factory profiles across **Handguns & PCCs** (9mm 115gr/124gr/+P/147gr sub, .40 S&W, 10mm Auto target & 200gr hard cast, .45 ACP ball & +P, .380 ACP, .38 Spl, .357 Mag, .44 Mag, 5.7x28mm, .357 SIG), **Rifles & Carbines** (5.56 NATO M193/M855/MK262/V-MAX, .300 BLK sup/sub, 7.62x39mm, 6.5 Grendel, 6mm ARC), **Precision & Long Range** (.308 Win M80/FGMM/SMK, 6.5 Creedmoor ELD-M/ELD-X, .30-06, .300 Win Mag, .338 Lapua, 7.62x54mmR, .45-70 Gov, .50 BMG), and **Rimfire & Shotgun** (.22 LR standard/HV/hyper/Stinger, .22 WMR, .17 HMR, 12 Gauge slug/00 buckshot, 20 Gauge slug).
- **Firearm Barrel Length Velocity Scaling Engine**:
  - Caliber-tailored empirical velocity scaling ($\pm 10\text{--}45\text{ fps/inch}$) with non-linear short-barrel rifle (SBR) corrections.
  - Quick barrel length presets per caliber (e.g. 7.5", 10.5", 11.5", 14.5", 16.0", 18.0", 20.0" for 5.56; 3.1", 3.7", 4.0", 4.5", 5.0", 16.0" for 9mm; 5.5", 7.5", 9.0", 10.5", 16.0" for .300 BLK).
  - Steppers (`-0.5"`, `+0.5"`) and direct numeric input with real-time velocity comparison readout comparing manufacturer test barrel vs your actual barrel length.
  - Live DOPE table updates reflecting true downrange drop and turret click corrections.

## [2.6.0-nightly.2] - 2026-08-18 (Nightly Test Build)
### Added
- **Target MOA Grouping Analyzer & Scope Zeroing Assistant**: Multi-step interactive touch canvas to scale paper targets, plot point of aim (POA), mark bullet holes (POI), and calculate Extreme Spread, Mean Radius, MOA, and Scope Turret Click Corrections (1/4 MOA, 1/2 MOA, 0.1 MIL).
- **Range Bag Packing Checklist Mode ("Range Prep")**: Select firearms to bring -> automatically aggregates required ammunition lots, magazines, and range gear essentials with persistent packing progress and discipline presets (CCW, Precision Rifle, Steel Challenge).
- **Maintenance Lifecycle Milestones & Malfunction Diagnostics**: Real-time wear gauges for recoil springs, extractor, and deep cleaning with 1-tap service resets. 1-tap failure diagnostics (FTF, FTE, Stovepipe, Double Feed, Light Strike) with root-cause analysis and gun-ammo compatibility warnings.
- **Offline DOPE & Ballistic Drop Calculator**: Simple Mode (factory commercial ammo database across 12 popular calibers) and Advanced Mode (G1 numerical point-mass solver with environmental corrections and 500yd+ DOPE card).
- **Private Bill of Sale PDF Generator & DL Scanner**: AAMVA 2D barcode scanner for buyer Driver's Licenses, statutory legal acknowledgments, dual touch signature canvas, watermarked 1-page PDF generation, 1-tap SMS/Email delivery to both parties, and permanent archival to the firearm details card.
- **100% On-Device Bench Voice Memos**: Private, zero-cloud audio recording for range and bench notes with playback and 1-tap "Wipe All Voice Logs" purge controls for total privacy compliance.

## [2.6.0-nightly.1] - 2026-08-18 (Nightly Test Build)
### Added
- **Automatic Desktop Synchronization**: When connected to the desktop vault over Wi-Fi, pending changes (range logs, stock audits, scans) automatically sync in the background without needing manual sync button taps.
- **Tactical Dark Dialog & Toast System**: Completely overhauled popup confirmation dialogs with custom dark modals for destructive actions (Unpair, Delete item, Clear queue) and sleek auto-dismissing floating toasts for successes and quick adjustments.
- **Update Channel Selector (Stable vs Nightly)**: Added in-app setting to toggle between Stable production releases and Nightly testing builds with dedicated APK routing.
- **Nightly Build Website Download Grid Integration**: Added Android Mobile Companion download card to GitHub Pages website with live channel switching support.

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
