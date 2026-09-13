# Security Policy

## Supported Versions

ArmoryVault Companion maintains active security updates and patch support for the **two most current stable production releases**. Because Android's `PackageInstaller` strictly prohibits version downgrades, users are encouraged to stay up to date with the latest unified release.

| Version | Android versionCode | Status | Security Support |
| :--- | :--- | :--- | :---: |
| **`v2.7.10`** | `319` | Current Stable Production | Supported |
| **`v2.7.9`** | `318` | Previous Production Release | Supported |
| **`<= v2.7.8`** | `< 318` | Legacy Releases | EOL (Upgrade Required) |

---

## Core Security & Privacy Model

ArmoryVault Companion is engineered specifically for privacy-first, zero-cloud firearm and ammunition inventory management:

- **100% Zero-Cloud Architecture**: The mobile application does not transmit firearm records, serial numbers, ammunition counts, range logs, Bill of Sale documents, or intake photos to any remote third-party cloud servers or external telemetry endpoints.
- **Local Network (LAN) Peer-to-Peer Sync**: Pairing with ArmoryVault Desktop operates exclusively over the local Wi-Fi router (LAN) using ephemeral single-use pairing tokens exchanged via QR code.
- **Hardware-Backed Biometric Security**: When enabled, vault access requires local device biometric authentication (Fingerprint / Face ID) backed by the Android `BiometricPrompt` API.
- **Encrypted Local Storage**: Sensitive credentials, pairing tokens, and cache entries are kept in private sandboxed app storage.
- **Downgrade Attack Protection**: Strict monotonic `versionCode` enforcement prevents installation of older, potentially vulnerable packages over newer builds (`INSTALL_FAILED_VERSION_DOWNGRADE`).

---

## Reporting a Vulnerability

We take the security and confidentiality of ArmoryVault users extremely seriously. If you identify a security vulnerability, flaw in local cryptographic mechanisms, or potential exploit:

1. **GitHub Security Advisory (Preferred)**:
   Submit a private report via GitHub:
   [Report a Vulnerability on GitHub](https://github.com/cook0001/ArmoryVault-Companion-App/security/advisories/new)
   
2. **Email Disclosure**:
   For private disclosures outside of GitHub, you may reach out directly to the maintainer via the email address listed in the project commit profile.

### Disclosure Guidelines
- Please provide detailed reproduction steps, target Android version, and proof-of-concept payloads where applicable.
- Allow reasonable time for remediation prior to public disclosure.
- We will acknowledge receipt of reports promptly and provide ongoing updates until a patch is released.
