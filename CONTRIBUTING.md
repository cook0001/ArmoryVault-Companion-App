# Contributing to ArmoryVault Companion

Thank you for your interest in contributing to **ArmoryVault Companion**! This project is the official Android companion application for the ArmoryVault platform, built with React Native and Expo.

---

## 🏛️ Guiding Architectural Principles

1. **100% Zero-Cloud Architecture**: The companion app must NEVER transmit firearm records, serial numbers, range sessions, or voice logs to remote cloud endpoints or analytics trackers.
2. **Android VersionCode Baseline Monotonic Increase (Strict)**: `versionCode` in `app.json` and `android/app/build.gradle` must strictly increment with every build and NEVER drop below the established baseline (`>= 309`).
3. **Rule #7 Strict Emoji Ban**: Never use raw emojis as UI icon placeholders. Always use custom vector SVG components or `@expo/vector-icons`.
4. **Desktop Sync Compatibility**: All sync item payloads must remain compatible with ArmoryVault Desktop's local sync inbox.

---

## 🛠️ Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/cook0001/ArmoryVault-Companion-App.git
   cd ArmoryVault-Companion-App
   ```

2. **Install dependencies (strictly use npm)**:
   ```bash
   npm install
   ```

3. **Start the Expo development server**:
   ```bash
   npx expo start
   ```

---

## 🧪 Testing & Pre-Flight Quality Gates

Before opening a pull request, run all automated checks locally:

- **Unit Tests**:
  ```bash
  npm test
  ```
- **TypeScript Typecheck**:
  ```bash
  npx tsc --noEmit
  ```
- **Pre-Flight Validation**:
  ```bash
  ./preflight.sh
  ```

---

## 📋 Submitting Pull Requests

1. Branch off `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Commit your changes using conventional commit messages.
3. If making code changes or bug fixes, automatically bump the version in `package.json`, `app.json`, `android/app/build.gradle`, and `utils/updater.ts`, and document changes in [`CHANGELOG.md`](CHANGELOG.md).
4. Push your branch and submit a PR to `main` following the checklist in `.github/pull_request_template.md`.
