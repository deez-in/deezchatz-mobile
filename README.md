
# Nijhum 🤫

[![Expo SDK](https://img.shields.io/badge/Expo_SDK-57-blue?logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.86-61DAFB?logo=react)](https://reactnative.dev)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-orange.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-lightgrey)]()
[![Signal Protocol](https://img.shields.io/badge/Encryption-Signal_Protocol-green?logo=signal)](https://signal.org/docs/)

**Nijhum** is an end-to-end encrypted messaging application built for private, secure communication.
A safe & secure world for just the two of you and nobody else.

Built with end-to-end encryption powered by the Signal Protocol, this is a privacy-first chat app that takes your conversations seriously.

Built with ❤️ in **India**, for the **world**.

---

## Features

### Current
- [x] One-to-one: text messages *(partially working — actively under development)*
- [x] End-to-end encryption via Signal Protocol (X3DH + Double Ratchet)
- [x] Encrypted local storage (SQLCipher via `expo-sqlite`)
- [x] Contact syncing & bundle synchronization
- [x] Key change notifications & system message rendering
- [x] Dark & light theme support
- [x] Automated Jest unit testing suite

### Roadmap
- [ ] Voice notes
- [ ] File sharing
- [ ] Voice & video calls (WebRTC)
- [ ] Group chats (many-to-many messaging)
- [ ] Post-quantum security
- [ ] Multi-device support

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Expo](https://expo.dev) (SDK 57) with [Expo Router](https://docs.expo.dev/router/introduction/) |
| **UI** | React Native 0.86, React 19.2 with Reanimated 4.5 animations |
| **State Management** | [Zustand](https://github.com/pmndrs/zustand) with SecureStore persistence |
| **Crypto** | [Signal Protocol](https://signal.org/docs/) — X3DH, Double Ratchet, VXEdDSA |
| **Native Crypto Module** | [expo-libsignal-dezire](https://github.com/nijhum-in/expo-libsignal-dezire) (Rust C-FFI native module) |
| **Transport** | MQTT over TLS (via `expo-native-mqtt`) |
| **Local Database** | [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) with SQLCipher encryption |
| **Secure Storage** | [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/) for key material |
| **Testing** | Jest (`jest-expo`), React Native Testing Library |

---

## Architecture

```
nijhum-mobile/
├── .github/
│   └── workflows/            # GitHub Actions workflows (e.g. build-android.yml)
├── src/
│   ├── app/                  # Expo Router screens & layouts
│   │   ├── (tabs)/           # Tab-based navigation (home, settings)
│   │   ├── chat/             # Chat conversation screen
│   │   ├── register/         # User registration flow
│   │   └── _layout.tsx       # Root layout
│   ├── components/           # Reusable UI components
│   │   ├── ChatBubble.tsx    # Message bubble
│   │   ├── OtpInput.tsx      # OTP verification input
│   │   ├── StyledButton.tsx  # Themed button
│   │   └── ...
│   ├── hooks/                # Custom React hooks (theming, etc.)
│   ├── store/                # Zustand state stores
│   ├── utils/
│   │   ├── crypto/           # Signal protocol implementation (x3dh, ratchet, etc.)
│   │   ├── transport/        # MQTT client & messaging transport API
│   │   ├── storage/          # SQLite database layer (SQLCipher) & connection coalescing
│   │   ├── messaging/        # Message encoding, send/receive handlers
│   │   └── helpers/          # Utility functions
│   ├── assets/               # Images, fonts, and static assets
│   └── polyfills/            # Platform polyfills
├── tests/                    # Unit testing suite
│   ├── setup.ts              # Jest mocks & environment configuration
│   └── store/                # Zustand store tests
├── app.config.ts             # Expo app configuration & plugins
└── eas.json                  # Expo Application Services build configuration
```

---

## Getting Started

### Prerequisites

- **Bun** — ([install from bun.sh](https://bun.sh))
- A physical device or emulator/simulator set up for development
- [Set up your development environment](https://docs.expo.dev/get-started/set-up-your-environment/) if this is your first time with Expo

> [!IMPORTANT]
> This project uses an **Expo development build** (not Expo Go). You will need to build a custom dev client before running the app.

### 1. Clone the repository

```bash
git clone https://github.com/nijhum-in/nijhum-mobile.git
cd nijhum-mobile
```

### 2. Install dependencies

```bash
bun install
```

### 3. Build & run the dev client

```bash
bun android    # Run on Android emulator/device
bun ios        # Run on iOS device
bun ios-sim    # Run on iOS simulator
bun start      # Start Expo development server
```

---

## Testing

The project uses **Jest** with `jest-expo` and React Native Testing Library for unit testing.

```bash
# Run the unit test suite
bun run test
```

---

## CI/CD & Automated Builds

The repository includes GitHub Actions workflows (`.github/workflows/build-android.yml`) for automated APK generation:

- **Triggers**: On publishing a new GitHub release or via manual `workflow_dispatch`.
- **EAS Local Build**: Uses EAS CLI locally in GitHub Actions to build standalone Android APKs without requiring Expo cloud credits.
- **Artifacts**: Automatically attaches generated `.apk` binaries to GitHub Releases and uploads workflow build artifacts.

---

## Signal Protocol Implementation

The encryption layer follows the [Signal Protocol specification](https://signal.org/docs/):

- **X3DH** — Extended Triple Diffie-Hellman for asynchronous key agreement
- **Double Ratchet** — Forward & backward secrecy for every message
- **VXEdDSA** — For signing & authentication

Cryptographic operations are executed natively via `expo-libsignal-dezire`, an Expo native module wrapping high-performance Rust C-FFI bindings.

---

## Backend

The server-side infrastructure uses [VerneMQ](https://vernemq.com/) as the MQTT broker, secured with TLS for all client connections. Messages are relayed in real-time over MQTT — the broker never has access to plaintext message content thanks to the end-to-end encryption handled entirely on the client side.

> The backend is intentionally minimal by design. The broker acts as a dumb pipe — it routes encrypted blobs between clients and that's it. Your messages, your keys, your business 🤫.

---

## Acknowledgements

This project stands on the shoulders of some incredible open-source work:

- **[Signal Protocol](https://signal.org/docs/)** — for pioneering the gold standard in end-to-end encryption
- **[Expo](https://expo.dev)** — for making cross-platform React Native development a joy
- **[VerneMQ](https://vernemq.com/)** — for a rock-solid, scalable MQTT broker
- **[Zustand](https://github.com/pmndrs/zustand)** — for delightfully simple state management
- **[expo-libsignal-dezire](https://github.com/debarkamondal/expo-libsignal-dezire)** — for native Rust Signal protocol FFI bindings
---

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)** — see the [LICENSE](LICENSE) file for details.

**TL;DR:** You're free to use, modify, and distribute this software, but the source code must remain free and open source. If you run a modified version on a server, you must share the source. Because privacy should be everyone's right, not just a feature 🤫.

