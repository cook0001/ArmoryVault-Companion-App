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

## 🏷️ Unified Release Strategy

The ArmoryVault ecosystem uses a single, unified release stream for both Desktop and Mobile applications:

| Application | Production Tag Format | Distribution |
| :--- | :--- | :--- |
| **Desktop App** | `vX.Y.Z` (e.g. `v2.8.0`) | GitHub Releases (macOS dmg, Windows exe, Linux AppImage) |
| **Mobile Companion** | `vX.Y.Z` (e.g. `v2.7.0`, versionCode $\ge$ 309) | GitHub Releases (Android APK) & In-App OTA Updater |

---

## 📊 Master Version Compatibility Matrix

| Desktop Version | Mobile Version | Compatibility Status | Supported Capabilities |
| :--- | :--- | :---: | :--- |
| **`v2.8.x`** *(Current)* | **`v2.7.x`** *(Current)* | ⭐️ **Full (100%)** | • Full Inventory Sync (Firearms, Ammo, Components, Accessories)<br>• Mobile Chronograph velocity strings (`/api/chrono`)<br>• Target & Grouping Analysis sync (`/api/target-analysis`)<br>• Safe & Storage Location sync (`/api/storage-locations`)<br>• Ballistic DOPE Profiles sync (`/api/ballistic-profiles`)<br>• Real-time Pairing QR & Remote Vault Lock<br>• Mobile Firearm Intake & Photo Upload |
| **`v2.7.x`** | **`v2.6.x` / `v2.5.x`** | ⭐️ **Full (Core Sync)** | • Core Local Wi-Fi Pairing & Ping<br>• Complete Inventory Caching & Summary views<br>• Range Sessions, Outbox Sync & Bill of Sale exports |
| **`v2.4.x` and older** | Any | ❌ **Unsupported** | • Legacy format before encrypted auth tokens. Upgrading is required. |

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

## 🤖 Android Native VersionCode Protocol

### Android Operating System Invariant
Android's system `PackageManager` strictly prohibits **in-place version downgrades**. If an APK has a lower or equal `versionCode` than the currently installed build on the device, Android aborts installation with `INSTALL_FAILED_VERSION_DOWNGRADE` ("App not installed").

### VersionCode Standard
- **Production Baseline**: All Android builds maintain a strictly monotonic `versionCode >= 309`.
- **Monotonic Progression**: Every unified release increments `versionCode` (e.g., `309`, `310`, `311`...).
- **Backward Compatibility**: Setting `versionCode 309` on `v2.7.0` enables all existing users who ran either Stable (`versionCode 300`) or Nightly (`versionCode 308`) to upgrade directly in-place without uninstalling.
- **Automated Validation**: [`preflight.sh`](file:///Users/danielc/Documents/ArmoryVault_Companion_Stable/preflight.sh) automatically validates that the build's `versionCode` satisfies the baseline.

---

## 🎯 Recommended Deployment Configuration

* **Desktop**: `v2.8.2` (Unified Production Release)
* **Mobile**: `v2.7.10` (Unified Production Release, `versionCode 319`)
* **Capabilities**: Full offline inventory sync, real-time ballistic profiles, chronograph velocity strings, shot grouping calculator, mobile firearm intake & photo uploads, secure LAN pairing token exchange, remote vault lock, automated Bill of Sale archival & sync, desktop-grade shotgun shell classification & inspecting modal, overpressure (+P / +P+) visual tags and 1-tap rating toggles, and seamless edge-to-edge storage filter chips.
