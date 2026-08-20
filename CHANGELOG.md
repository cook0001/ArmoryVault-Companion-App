# Changelog

## [2.6.0-nightly.35] - 2026-08-20 (Nightly Test Build)
### Fixed
- **Stable to Nightly Upgrade Startup Crash Fix & GitHub Release Deployment**:
  - Purged stale CXX CMake cache bindings and rebuilt production release binaries with clean React Native autolinking.
  - Verified elimination of `expo-updates` bundle-loading deadlock so upgrading from stable (v2.5.1) to nightly (v2.6.0-nightly.35) boots instantly without crashing.
  - Updated in-app version metadata and fallback strings for accurate release channel checks.

## [2.6.0-nightly.34] - 2026-08-19 (Nightly Test Build)
### Fixed
- **Fix Standalone Release APK Crash on Startup**:
  - Removed unconfigured `expo-updates` package which caused native `ReactNativeHostHandler` startup deadlocks when attempting to resolve embedded JS bundle assets in standalone production APKs.
  - Removed redundant `expo.modules.updates.ENABLED` metadata tag from `AndroidManifest.xml`.
  - Added ProGuard keep rules for `react-native-worklets` and `react-native-gesture-handler` native bindings.

## [2.6.0-nightly.33] - 2026-08-19 (Nightly Test Build)
### Added
- **Multi-Core Hardware Acceleration & Turbo Build Engine**:
  - Expanded Gradle heap to `-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+UseParallelGC` to eliminate GC swapping on multi-core host machines.
  - Enabled multi-core Gradle parallel execution (`org.gradle.parallel=true`, `--max-workers=8`), native Gradle build caching (`org.gradle.caching=true`), and file system watching (`org.gradle.vfs.watch=true`).
  - Added parallel C++ CMake compilation (`CMAKE_BUILD_PARALLEL_LEVEL=8`) across `publish-nightly.sh` and `publish-release.sh`.
  - Created `build-local-fast.sh` for lightning-fast single-ABI (`arm64-v8a`) on-device testing.

## [2.6.0-nightly.32] - 2026-08-19 (Nightly Test Build)
### Fixed
- **Gradle 9 & 10 Modern Groovy DSL Syntax Compliance**:
  - Replaced legacy method-call syntax (`url '...'`, `ndkVersion ...`, `namespace '...'`, `signingConfig ...`, `shrinkResources ...`, `crunchPngs ...`, `useLegacyPackaging ...`, `ignoreAssetsPattern ...`) with modern assignment syntax (`=`) across `android/build.gradle` and `android/app/build.gradle`.
  - Resolved all Groovy DSL deprecation warnings in the Gradle Problems Report, ensuring forward compatibility with Gradle 10.

## [2.6.0-nightly.31] - 2026-08-18 (Nightly Test Build)
### Added
- **Redesigned High-Definition Tactical Cyber Shield App Icon**:
  - Replaced legacy Expo template icon with a custom 3D brushed titanium and gunmetal cyber shield app icon matching the ArmoryVault Desktop application.
  - Features neon cyan (`#00f0ff`) and emerald green (`#10b981`) illuminated bevels, central mechanical combination vault dial and padlock shackle, set on a dark carbon-fiber textured plate.
  - Generated full Android Adaptive Icon layers (`ic_launcher_foreground`, `ic_launcher_background`, `ic_launcher_monochrome`) across all mipmap densities (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`).
  - Added high-resolution splash screen emblem (`splashscreen_logo.png`) and updated native launcher colors to `#0b0f19` dark tactical theme.

## [2.6.0-nightly.30] - 2026-08-18 (Nightly Test Build)
### Fixed
- **App Crash on Launch Fix & Standalone Local Boot**:
  - Disabled `expo.modules.updates.ENABLED` in `AndroidManifest.xml` and removed legacy EAS update tags to eliminate runtime version mismatch crashes on launch.
  - Replaced blocking initialization checks with non-blocking, exception-safe wrappers in `_layout.tsx` for biometrics and silent updates.
  - Ensured the app boots 100% locally and instantaneously from its embedded release bundle with zero cloud dependencies.

## [2.6.0-nightly.29] - 2026-08-18 (Nightly Test Build)
### Added
- **Preserved Offline Mobile Cache during Desktop Vault Lock**:
  - Maintained complete local offline mobile inventory cache across firearms, ammo lots, powders/primers, DOPE calculations, and range logs when locking the desktop database.
  - Updated confirmation modal and status beacon to clarify that remote desktop lock secures the PC while keeping the mobile companion 100% functional for offline range sessions.

## [2.6.0-nightly.28] - 2026-08-18 (Nightly Test Build)
### Added
- **Remote Database Lock & Air-Gapped Cache Auto-Wipe**:
  - Added 1-tap `[Lock Desktop]` button with confirmation modal in the mobile connection beacon to lock the desktop vault remotely.
  - Automatically wipes mobile SQLite/AsyncStorage cached inventory, firearms, ammo, and summary counters whenever the desktop vault locks for security and privacy.
  - Heartbeat automatically detects desktop lock/unlock transitions and safely resynchronizes when unlocked.

## [2.6.0-nightly.27] - 2026-08-18 (Nightly Test Build)
### Added
- **Position-Sorted Index Parser & Raw Barcode Inspector**:
  - Implemented position-sorted index AAMVA parsing to seamlessly unpack single-strip continuous Florida PDF417 barcodes.
  - Added collapsible "Inspect Raw Barcode String" console to the ID Preview sheet for full diagnostic visibility.

## [2.6.0-nightly.26] - 2026-08-18 (Nightly Test Build)
### Added
- **Florida Name Normalization (Last First Middle -> First Middle Last)**:
  - Automatically recognizes and converts Florida DHSMV name ordering (`[Last] [First] [Middle]` or `[Last], [First] [Middle]`) into standard Legal Name order (`[First] [Middle] [Last]`).
  - Enhanced ID Preview Sheet with clear badges (`2D Matrix` vs `1D Barcode`) and interactive guidance to easily rescan the 2D matrix for full address, DL#, and DOB.

## [2.6.0-nightly.25] - 2026-08-18 (Nightly Test Build)
### Added
- **Synchronous Scan-Lock & Instant Scanned ID Confirmation Modal**:
  - Replaced asynchronous state checks with synchronous `useRef` locking to eliminate rapid multi-frame vibration and haptic feedback loops.
  - Added interactive Scanned ID Confirmation Sheet displaying Legal Name, DL#, Street Address, and DOB with 1-tap "Apply to Bill of Sale Form" and "Rescan" actions.

## [2.6.0-nightly.24] - 2026-08-18 (Nightly Test Build)
### Added
- **Subfile Header DAQ Parser & Strict PDF417 Vision Isolation**:
  - Configured CameraView to strictly isolate 2D `pdf417` optical capture when scanning driver's licenses, preventing hardware sensors from triggering on linear 1D barcodes.
  - Added support for Florida DHSMV subfile headers where `DAQ` is concatenated with document identifiers without preceding line breaks.

## [2.6.0-nightly.23] - 2026-08-18 (Nightly Test Build)
### Added
- **Delimiter-Safe Regex Field Extractor for AAMVA Driver's Licenses**:
  - Completely redesigned AAMVA field extraction to use strict delimiter-bounded pattern matching, preventing subfield truncation across Florida DHSMV and all 50 US State formats.
  - Automatically extracts and formats: Full Legal Name, Residential Street Address, City, State, 5-Digit ZIP, DL/ID Number, and Date of Birth (`MM/DD/YYYY`).

## [2.6.0-nightly.22] - 2026-08-18 (Nightly Test Build)
### Added
- **2D PDF417 Matrix Lock & Non-Dismissing Guidance**:
  - In 2D Matrix mode, the scanner remains open and actively prompts the user if the top 1D barcode is encountered, ensuring the user aligns the 2D PDF417 matrix for full Address (Street, City, State, ZIP), DL#, and DOB extraction.
  - Eliminated false/ghost state strings in the address field when only 1D data is present.

## [2.6.0-nightly.21] - 2026-08-18 (Nightly Test Build)
### Added
- **Scanner Viewfinder Mode Switcher & Non-Polluting Name Capture**:
  - Added dedicated on-screen toggle between **2D Matrix (Full ID)** and **1D Barcode** with active camera remount keys to ensure hardware sensor isolation.
  - Added parser support for prefix-only barcodes (`DL [LastName] [FirstName]`), routing names exclusively to `buyerName` and preventing false DL# field pollution.

## [2.6.0-nightly.20] - 2026-08-18 (Nightly Test Build)
### Added
- **Intelligent 1D Linear & 2D Matrix ID Field Parser**:
  - Automatically isolates and parses 1D linear barcode formats (`DL# LastName FirstName`) into separate `buyerName` and `buyerDlNumber` fields.
  - Full 2D AAMVA PDF417 support for extracting complete name, residential street address, city, state, zip code, and date of birth (`MM/DD/YYYY`).
  - Added real-time scan feedback distinguishing full 2D auto-fills from 1D barcode captures.

## [2.6.0-nightly.19] - 2026-08-18 (Nightly Test Build)
### Added
- **Dedicated 2D PDF417 Driver's License Scanner Mode**:
  - Configured ID scanner to strictly target 2D PDF417 matrix barcodes, preventing accidental capture of secondary 1D linear barcodes.
  - Added full support for Track 1, Track 2, and AAMVA PDF417 formats.
- **Persistent Multi-Rail Payment Profile**:
  - Saved seller profile and payment accounts (Cash App, PayPal, Venmo, Stripe/Square, Zelle) auto-load across all sessions.
  - Live auto-save on any payment handle edits inside the payment modal.

## [2.6.0-nightly.18] - 2026-08-18 (Nightly Test Build)
### Added
- **Florida & Multi-State AAMVA PDF417 Parser Overhaul**:
  - Implemented token-boundary parser supporting Florida DHSMV `<` delimiters, multi-line formats, and concatenated field streams.
  - Accurately maps Name, Street Address, City, State, 5-digit ZIP, DL Number, and formatted DOB (`MM/DD/YYYY`).
- **Dynamic Pre-Filled Payment Links & QR Generator**:
  - Direct integration for **Cash App Pay** (`$cashtag/amount`), **PayPal.me** (`paypal.me/user/amount`), **Venmo** (`venmo.com/user?txn=pay&amount=...`), **Stripe/Square**, and **Zelle**.
  - Automatically generates scannable QR codes with exact dollar amount pre-filled and supports live preview testing.

## [2.6.0-nightly.17] - 2026-08-18 (Nightly Test Build)
### Added
- **Multi-Format AAMVA PDF417 Driver's License Parser**:
  - Upgraded parser with support for all AAMVA specification revisions (2000–2020+), correctly extracting full legal names, street address, city, state, 5-digit zip code, DL/ID number, and date of birth.
  - Added protection to prevent raw barcode strings from overflowing into input fields.
- **Secure Card & Digital Payment Generator**:
  - Added PCI-compliant instant Payment QR Code and checkout link generator directly inside the Bill of Sale form.
  - Supports Apple Pay, Google Pay, Debit/Credit Card, and digital transfers with automated auth reference tagging.

## [2.6.0-nightly.16] - 2026-08-18 (Nightly Test Build)
### Added
- **Persistent Vault Owner / Seller Profile in Bill of Sale**:
  - Saved seller profile (Name, Address, DL#, Phone, Email) auto-populates on every bill of sale.
  - Prominent full-width Buyer ID scan banner with improved visual hierarchy.
  - Payment method selector with Money Order / Check number tracking.
- **Handload Recipe Lot # & Printable Ammo Box Labels**:
  - Automatic Lot Number generation (`LOT-YYYYMMDD-XXX`) on new recipes and batches.
  - 1-tap "Box Label" print generator creating 3.5" ammo box labels with embedded QR codes.
  - Universal Scanner auto-detects `AV-RECIPE-` QR codes to load handload recipes.
- **Ballistics DOPE Card Print Fix**:
  - Replaced custom paper size styling with universal system print dialog via `Print.printAsync` for reliable AirPrint, Android Print, and PDF export.

## [2.6.0-nightly.15] - 2026-08-18 (Nightly Test Build)
### Added
- **Voice Memos & Outbox Polish**:
  - **Firearm & Ammo Tagging in Voice Memos**: Tag memos to specific firearms or suspected bad ammo lots for diagnostic records.
  - **1-Tap Privacy Wipe**: Purge all local voice logs with single-tap privacy protection.
  - **Sync Outbox Enhancements**: Added 1-tap manual sync button with live transmission progress and clear outbox action.

## [2.6.0-nightly.14] - 2026-08-18 (Nightly Test Build)
### Added
- **Integrated Driver's License & CCW Barcode Scanner in Bill of Sale**:
  - Embedded camera scanner directly in Bill of Sale form to scan 2D AAMVA PDF417 barcodes on Driver's Licenses and CCW permits.
  - Automatically parses and populates legal full name, residential address, license number, DOB, and CCW permit details.
- **Ballistics DOPE Enhancements**:
  - **Handload Recipe Import**: 1-tap import of custom handload recipes to auto-populate muzzle velocity, bullet weight, and caliber in the solver.
  - **Maximum Point Blank Range (MPBR) Calculator**: Automatically computes near zero, far zero, and max point-blank range for a 6" vital zone.
  - **Pocket DOPE Card PDF Export**: Generate and share clean, waterproof-style pocket DOPE cards formatted for printing or offline field reference.

## [2.6.0-nightly.13] - 2026-08-18 (Nightly Test Build)
### Added
- **Ammo & Supplies Reloading Recipes & Valuation**:
  - **Handload Recipes & Batches Tab**: Added dedicated recipes tab to record custom load recipes (Bullet, Powder, Grains, Primer, Brass, COAL) with velocity (fps), MOA group size, and batch tracking.
  - **Vault Valuation Privacy Toggle**: 1-tap eye icon on the top banner to toggle display of total aggregate vault inventory valuation ($X,XXX.XX).
  - **Cost-Per-Round (CPR) Readouts**: Live CPR pricing on ammunition lot cards.
  - **Low-Stock Warning Indicators**: Visual warning badges when caliber counts drop below low-inventory thresholds.

## [2.6.0-nightly.12] - 2026-08-18 (Nightly Test Build)
### Added
- **Firearms Vault & Bill of Sale Overhaul**:
  - **Category Filtering & Sorting**: Instant filter tabs (`All`, `Handguns`, `Rifles`, `Shotguns`, `Rimfire`, `NFA/Suppressed`) and sorting (`A-Z`, `Highest Round Count`).
  - **1-Tap Scan Part Trigger**: Quick button on each firearm card to scan replacement parts and queue maintenance items to the desktop maintenance ledger.
  - **FFL Dealer vs Private Sale Mode**: Added toggle for FFL Dealer Consignment/Transfer including FFL Number and Bound Book fields.
  - **Concealed Carry License (CCL / CCW) Support**: Track CCW permit numbers, issuing states, and expiration dates.
  - **Statutory Legal Affirmations**: Form 4473 style checkboxes for legal age, non-prohibited person status under 18 U.S.C. § 922(g), in-state residency, and lawful title.
  - **Multi-Channel Distribution**: 1-tap Print (AirPrint/Android Print), native Share/SMS, and Email delivery.

## [2.6.0-nightly.11] - 2026-08-18 (Nightly Test Build)
### Added
- **Range Mode Enhancements**:
  - **Incremental Rapid Round Steppers**: Added quick `+10`, `+25`, `+50`, and `+100` round steppers alongside preset chips.
  - **Live Ammo Inventory Deduction Preview**: Displays live inventory deduction calculations and remaining rounds before queuing.
  - **Collapsible Advanced Environmental Log**: Optional drawer for temperature (°F), wind speed/direction, and target distance.
  - **Section Numbering & Layout Polish**: Streamlined sections from firearm selection to target photo zeroing and notes.

## [2.6.0-nightly.10] - 2026-08-18 (Nightly Test Build)
### Added
- **Universal Scanner Enhancements**:
  - **Animated Laser Viewfinder**: Sweeping laser reticle animation across the camera scan target for high-precision visual scanning feedback.
  - **Caliber-Aware Packaging Multiplier Dialog**:
    - Pop-up dialog with interactive `Number of Boxes × Rounds/Box` multiplier with real-time total quantity calculation.
    - Intelligent caliber-specific presets: 25 rds (defensive pistol), 20 rds (rifle), 50 rds (target pistol), 100 rds, 325/500 rds (rimfire brick), 1000 rds (case).
    - Expanded packaging units: `Box`, `Case`, `Can (Ammo Can)`, `Sleeve`, `Brick`, `Loose (rds)`.
  - **Smart Inventory Quick Lookup Drawer**:
    - Bottom drawer with instant search filtering across cached ammo lots, calibers, components, and SKUs with 1-tap stock adjustment triggers without camera scanning.

## [2.6.0-nightly.9] - 2026-08-18 (Nightly Test Build)
### Added
- **1-Tap Firearm Selection Reset in Range Prep**:
  - Added a dedicated **"Reset Guns"** action button in the firearms selection header to quickly deselect all chosen firearms and allocated ammo without having to manually uncheck each card.
  - Enhanced the top progress reset modal with dual options (**"Reset Everything"** vs **"Uncheck Items Only"**).

## [2.6.0-nightly.8] - 2026-08-18 (Nightly Test Build)
### Added
- **Intelligent Firearm Feeding Gear Classifier in Range Prep**:
  - Automatically identifies action and feeding systems to suggest exact matching loading gear instead of generic detachable magazines:
    - **Revolvers**: Speedloaders, moon clips, and speed strips.
    - **Single-Shot & Break-Action Rifles/Pistols**: Cartridge belts and buttstock ammo cuffs.
    - **Break-Action Shotguns (O/U & SxS)**: Waist shell pouches and shooting vests.
    - **Tube-Fed Shotguns**: Side-saddles, elastic shell cards, and dump pouches.
    - **Lever-Action Rifles**: Buttstock ammo sleeves and cartridge wallets.
    - **Surplus & Clip-Fed Rifles (M1 Garand, SKS, Mosin, Mauser, Enfield)**: En bloc clips and stripper clips.
- **Custom Bag Preset Builder**:
  - Interactive preset creation modal to configure, name, iconize, and store persistent custom discipline packing lists.
  - Delete and switch between custom and built-in presets seamlessly.
- **Expanded Built-in Discipline Presets (10 Comprehensive Categories)**:
  - Added **USPSA / IDPA Match**, **Defensive Carbine / 2-Gun**, **Clay & Trap / Skeet**, **Suppressed & Low-Light**, and **Youth & Novice Training**.

## [2.6.0-nightly.7] - 2026-08-18 (Nightly Test Build)
### Changed
- **Dashboard Terminology**:
  - Renamed the main tool grid section header from "Vault Quick Actions" to **"Companion Tools"** to accurately reflect the comprehensive module suite of the mobile application.

## [2.6.0-nightly.6] - 2026-08-18 (Nightly Test Build)
### Changed
- **Dashboard Layout Optimization**:
  - Moved the **Cached Vault Summary** card to the top of the dashboard directly below the connection status beacon.

## [2.6.0-nightly.5] - 2026-08-18 (Nightly Test Build)
### Changed
- **Action Hub Sync Outbox Card**:
  - Converted the bottom standalone banner into a dedicated 8th Quick Action Card in the primary Vault Quick Actions grid on the dashboard.
  - Features real-time pending item count indicators, dynamic icon coloring, and balanced 2x4 action grid layout.

## [2.6.0-nightly.4] - 2026-08-18 (Nightly Test Build)
### Added
- **User-Controlled Release Stream Switching & Instant Rollback Support**:
  - Full channel toggle in Settings between **Official Stable** and **Nightly Pre-release** streams.
  - **Intelligent Downgrade Engine**: When a user on a Nightly build selects Stable Channel, the auto-updater recognizes the pre-release state and offers a **"Rollback to Official Stable Release"** download, smoothly bypassing normal forward-only semver constraints.
  - Dedicated **"Rollback to Latest Stable Release"** action button in Settings whenever a Nightly testing build is active.
  - Instant auto-check when switching release channels with custom user confirmations.

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
