# Changelog

All notable changes to the **DeezChatz Mobile** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.1] - 2026-09-11

### Fixed
- Added explicit ProGuard keep rules in `app.config.ts` for Netty and HiveMQ to fix MQTT connection failures in Android release builds.
- Bumped Android `versionCode` to `9`.

## [0.8.0] - 2026-09-10

### Added
- **End-to-End Encrypted Image Messaging**: Secure photo transmission over MQTT using Signal Protocol (X3DH and Double Ratchet).
- **Image Compression & Media Storage**: Automatic aspect-ratio preserving JPEG compression (1200px max dimension, 0.7 quality) and WhatsApp-style filesystem storage hierarchy (`Media/Images/` and `Media/Images/Sent/`).
- **Image Preview & Captioning**: In-app preview modal allowing users to review picked photos and add optional captions before sending.
- **Interactive Full-Screen Image Viewer**: Photo viewer with pinch-to-zoom and pan gestures powered by `react-native-gesture-handler` and `react-native-reanimated`.
- **Database Migrations**: Per-chat SQLite migration adding `caption` column to the `messages` table and image message support.

### Changed
- Updated Expo SDK 57 dependencies (`@expo/ui`, `expo`, `expo-glass-effect`, `expo-router`).
- Wrapped root layout and modal viewer with `GestureHandlerRootView`.
- Bumped Android `versionCode` to `8`.

### Fixed
- Fixed Android local notification scheduling trigger delay.

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
