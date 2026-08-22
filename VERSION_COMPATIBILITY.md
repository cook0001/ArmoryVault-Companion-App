# ArmoryVault Ecosystem — Version Compatibility Guide 🛡️📱

This document defines the interoperability specifications, local Wi-Fi synchronization protocols, API endpoint contracts, and release channel mappings between the **ArmoryVault Desktop Application** and the **ArmoryVault Companion Mobile Application**.

---

## 📋 Table of Contents
1. [Architecture Overview](#-architecture-overview)
2. [Release Channel Strategy](#-release-channel-strategy)
3. [Master Version Compatibility Matrix](#-master-version-compatibility-matrix)
4. [Local Wi-Fi API Endpoint Contract](#-local-wi-fi-api-endpoint-contract)
5. [Forward & Backward Compatibility Rules](#-forward--backward-compatibility-rules)
6. [Android Native VersionCode & Rollback Protocol](#-android-native-versioncode--rollback-protocol)
7. [Recommended Deployment Configurations](#-recommended-deployment-configurations)

---

## 🏛️ Architecture Overview

The ArmoryVault platform operates on a **Local-First, Zero-Cloud P2P Model**:
- **Desktop Application (Vault Host)**: Acts as the primary encrypted source of truth. When running on your local network (LAN), it hosts an embedded, encrypted HTTP server (default port `3456`) that handles pairing, inventory caching, and batch synchronization.
- **Mobile Companion (Mobile Client)**: Operates independently as an offline-first client. When connected to the same local Wi-Fi network as the desktop app, it pairs via QR code and syncs records bidirectionally.

```
┌────────────────────────────────────────────────────────┐
│               ARMORYVAULT DESKTOP (HOST)               │
│  • Encrypted SQLite Database (.enc)                    │
│  • Embedded Local HTTP Server (Port 3456)             │
│  • ATF Bound Book, DOPE Cards, Safe Organizer, Reloader │
└───────────────────────────▲────────────────────────────┘
                            │  Local Wi-Fi P2P
                            │  (Encrypted JSON Payloads)
┌───────────────────────────▼────────────────────────────┐
│            ARMORYVAULT COMPANION (CLIENT)              │
│  • Offline Cache (AsyncStorage + Scoped Storage)       │
│  • Barcode Scanner, Voice Memos, Chrono Logger         │
│  • Grouping Calculator & Tactical Range Outbox         │
└────────────────────────────────────────────────────────┘
```

---

## 🏷️ Release Channel Strategy

Both applications are released under synchronized dual-channel streams:

| Channel | Target Audience | Desktop Version Format | Mobile Version Format | Update Cadence |
| :--- | :--- | :--- | :--- | :--- |
| **Stable** | Production users seeking maximum stability | `vX.Y.Z` (e.g. `v2.7.4`, `v2.8.0`) | `vX.Y.Z` (e.g. `v2.5.1`, `v2.6.0`) | Monthly / Milestone releases |
| **Nightly** | Testers, range shooters, and early adopters | `vX.Y.Z-nightly.N` (e.g. `v2.8.0-nightly.6`) | `vX.Y.Z-nightly.N` (e.g. `v2.6.0-nightly.42`) | Continuous / Daily builds |

---

## 📊 Master Version Compatibility Matrix

| Desktop Version | Mobile Version | Channel Pairing | Compatibility Status | Supported Capabilities |
| :--- | :--- | :--- | :---: | :--- |
| **`v2.8.0-nightly.x`**<br>*(e.g. `v2.8.0-nightly.6`)* | **`v2.6.0-nightly.x`**<br>*(e.g. `v2.6.0-nightly.42`)* | 🟢 **Nightly ↔ Nightly** | ⭐️ **Full (100%)** | • Full Inventory Sync (Firearms, Ammo, Components, Accessories)<br>• Mobile Chronograph velocity strings (`/api/chrono`)<br>• Target & Grouping Analysis sync (`/api/target-analysis`)<br>• Safe & Storage Location sync (`/api/storage-locations`)<br>• Ballistic DOPE Profiles sync (`/api/ballistic-profiles`)<br>• Real-time Pairing QR & Remote Vault Lock |
| **`v2.7.0 – v2.7.4`** | **`v2.5.0 – v2.5.1`** | 🔵 **Stable ↔ Stable** | ⭐️ **Full (100%)** | • Core Local Wi-Fi Pairing & Ping<br>• Complete Inventory Caching & Summary views<br>• Range Sessions, Outbox Sync & Bill of Sale exports<br>• Offline Cache Mode |
| **`v2.7.x` (Stable)** | **`v2.6.0-nightly.x`** | 🟡 **Stable Desktop + Nightly Mobile** | ⚠️ **Partial (Core Sync Works)** | • Core inventory syncing (`/api/sync`) functions normally.<br>• Chrono strings and Target analyses queue safely in Mobile Outbox and wait until Desktop is upgraded to Nightly. |
| **`v2.8.0-nightly.x`** | **`v2.5.1` (Stable)** | 🟢 **Nightly Desktop + Stable Mobile** | ⭐️ **Full (Backward Compatible)** | • Desktop Nightly server implements 100% backward compatibility with all legacy `v2.5.x` payloads and endpoints. |
| **`v2.4.x` and older** | **`v2.6.x` / `v2.5.x`** | 🔴 **Legacy** | ❌ **Unsupported** | • Legacy format before encrypted auth tokens. Upgrading both Desktop and Mobile is required. |

---

## 🌐 Local Wi-Fi API Endpoint Contract

The Desktop application exposes the following REST endpoints on local port `3456`:

| Endpoint | Method | Introduced In | Purpose | Supported Mobile Payloads |
| :--- | :---: | :---: | :--- | :--- |
| `/api/ping` | `GET` | `v2.0.0` | Health check & network latency handshake | Any |
| `/api/pair` | `POST` | `v2.0.0` | Secure QR pairing token exchange | Token & device metadata |
| `/api/pair` | `GET` | `v2.2.0` | Active paired device status verification | Token verification |
| `/api/vault/lock` | `POST` | `v2.3.0` | Remote vault instant lock signal from mobile | Lock command |
| `/api/inventory/summary` | `GET` | `v2.0.0` | Fast inventory counts and category metrics | Query params |
| `/api/inventory/cache` | `GET` | `v2.1.0` | Full encrypted offline database payload download | JSON bundle |
| `/api/sync` | `POST` | `v2.0.0` | Master batch synchronization queue push | `SyncItem[]` array (Firearms, Ammo, Range Sessions, Outbox) |
| `/api/chrono` | `POST` | `v2.8.0-nightly.5` | Precision muzzle velocity string recording | `ChronoString` (Avg, SD, ES, shot list) |
| `/api/target-analysis` | `POST` | `v2.8.0-nightly.5` | Shot grouping & MOA target analysis | `TargetAnalysis` (MOA, spread, photos) |
| `/api/storage-locations` | `GET` | `v2.8.0-nightly.5` | Safes, cabinets, and ammo can location mapping | Location array |
| `/api/ballistic-profiles`| `GET` | `v2.8.0-nightly.5` | G1/G7 ballistic trajectories and DOPE cards | Profiles array |

---

## 🔄 Forward & Backward Compatibility Rules

1. **Non-Destructive Schema Parsing**:
   - The Desktop server ignores unrecognized JSON fields sent by newer mobile versions, storing raw payloads in the sync log without throwing runtime exceptions.
2. **Graceful Mobile Feature Degradation**:
   - If the Mobile Companion encounters a `404 Not Found` when posting to newer endpoints (e.g. `/api/chrono` on a `v2.7.x` Desktop build), the mobile app automatically retains the item in the local Outbox and displays a non-intrusive badge: *"Stored locally — Desktop server upgrade required to sync"*.
3. **Additive Sync Types**:
   - New synchronization types (`chrono_string`, `target_analysis`, `malfunction_report`) extend the `SyncItem.type` union without modifying existing types (`firearm`, `ammo`, `range_session`, `bill_of_sale`).

---

## 🤖 Android Native VersionCode & Rollback Protocol

### Android Operating System Constraint
Android's system `PackageManager` strictly prohibits **in-place version downgrades**. If an APK has a lower `versionCode` than the currently installed build on the device, Android aborts the installation with `INSTALL_FAILED_VERSION_DOWNGRADE` ("App not installed").

### VersionCode Standard
- **Production Baseline**: All Android builds maintain a monotonic `versionCode >= 300`.
- **Nightly Builds**: Increment `versionCode` with every release (e.g. `301`, `302`, `303`...).
- **Automated Validation**: [`preflight.sh`](file:///Users/danielc/Documents/ArmoryVault_Companion_Nightly/preflight.sh) automatically queries connected ADB devices to ensure the new build's `versionCode` is strictly greater than the installed build.

### How to Rollback from Nightly to an Older Stable Build
Because Android blocks in-place downgrades:
1. **Sync Records**: In the Mobile app, open **Settings** or **Outbox** and tap **Sync Now** to ensure all pending mobile records are stored in your Desktop Vault.
2. **Download Stable APK**: Tap **Rollback to Stable Release** -> **Download Stable APK** (or download from [GitHub Releases](https://github.com/cook0001/ArmoryVault-Companion-App/releases)).
3. **Uninstall Nightly App**: Long-press the ArmoryVault Companion icon on your Android home screen and tap **Uninstall**.
4. **Install Stable APK**: Open your phone's **Files / Downloads** app and tap the downloaded `app-release.apk`.

---

## 🎯 Recommended Deployment Configurations

### Scenario A: Precision Shooter & Beta Tester
* **Desktop**: `v2.8.0-nightly.6` (or latest Nightly)
* **Mobile**: `v2.6.0-nightly.42` (or latest Nightly)
* **Benefits**: Real-time ballistic profiles, chronograph sync, shot grouping calculator, shotgun shell spec labels, custom vector tactical icons.

### Scenario B: Production Vault & General Archival
* **Desktop**: `v2.7.4` (or latest Stable `v2.8.0` once promoted)
* **Mobile**: `v2.5.1` (or latest Stable `v2.6.0` once promoted)
* **Benefits**: Maximum release stability, full offline inventory tracking, ATF Bound Book printing.
