# Changelog

All notable changes to the **DeezChatz Mobile** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.7.1] - 2026-09-05

### Added
- App logo asset branding (`logo.png`) on the Google registration onboarding screen.

### Changed
- Replaced the welcome screen emoji with the new DeezChatz logo icon.
- Bumped Android `versionCode` to `7`.

---

## [0.7.0] - 2026-09-04

### Added
- **Voice Messaging**: End-to-end encrypted Opus voice notes using `expo-audio-opus`.
- Voice note audio recorder, audio player controls, and playback progress indicators in chat.
- Consolidate Android build and release workflows into a single unified matrix pipeline.

### Changed
- Dependency updates across Expo SDK 57 packages.

---

## [0.6.2] - 2026-09-02

### Added
- Local EAS build matrix strategy in GitHub Actions for standalone APK and AAB artifacts.
- Google Play internal testing deployment integration.

### Changed
- Enhanced contact name synchronization logic across chat view transitions and background notifications.

---

## [0.6.1] - 2026-09-01

### Fixed
- Contact names sync issue when opening active chats and in incoming background notifications.

---

## [0.6.0] - 2026-08-30

### Fixed
- iOS platform compatibility and layout bug fixes.

---

## [0.5.1] - 2026-08-25

### Added
- In-app account deletion flow and profile management screen.
- User-generated content (UGC) moderation and reporting mechanisms.
- On-device contact permission disclosure dialogs for Google Play policy compliance.

### Changed
- Centralized local storage layer using `expo-sqlite` with SQLCipher encryption.
- Refined Google Services configuration and build setup.

---

## [0.5.0] - 2026-08-15

### Added
- Initial Play Store internal release of DeezChatz.
- End-to-end encrypted 1-on-1 messaging using Signal Protocol (X3DH + Double Ratchet via `expo-libsignal-dezire`).
- Secure Google OAuth authentication (`expo-google-native-oauth`).
- Real-time transport over TLS with RMQTT (`expo-native-mqtt`).
- Background notifications via FCM and task manager integration.
- Themed UI supporting dynamic dark and light mode.
