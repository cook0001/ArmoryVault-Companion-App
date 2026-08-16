# Changelog

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
