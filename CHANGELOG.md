# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.2.19] - 2026-08-16

### Added
- **Detailed Sync Error Reporting:** Added specific alert dialogues that help diagnose network timeouts, server errors (404/500), and unreachable IP addresses when trying to sync with the desktop vault.
- **In-App Updater:** Added support for GitHub auto-updating for future APK releases.

### Fixed
- **Android APK Syncing:** Fixed an issue where standalone Android APK builds were silently blocking local network HTTP traffic (`usesCleartextTraffic`), which prevented the mobile app from connecting to the desktop server.
- **iOS Local Network Syncing:** Enabled `NSAllowsArbitraryLoads` to ensure iOS devices can properly communicate with the desktop application on local Wi-Fi.
