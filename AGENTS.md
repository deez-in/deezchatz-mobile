# AGENTS.md - DeezChatz Mobile

This document provides guidance for AI coding agents working in this codebase.

## Ecosystem Context

> **This is the mobile app that users install.** It sits at the top of the dependency stack and consumes all other Deez Chatz projects.

```
⭐ deezchatz-mobile (this repo)
  ├── expo-google-native-oauth (Native Module)
  ├── expo-libsignal-dezire (Native Module + Rust FFI)
  └── DeezChatz API (Backend via REST + MQTT)
```

| Component | How it's used |
|-----------|--------------|
| **expo-google-native-oauth** | Used in `src/app/register/` to get the Google `idToken` |
| **expo-libsignal-dezire** | Used in `src/utils/crypto/` for all cryptographic operations |
| **DeezChatz API** | Public API (port 3000) for registration/key discovery. Private API (port 3001) is internal to the backend. |
| **RMQTT** | The MQTT broker used for real-time encrypted messaging (via `expo-native-mqtt`) |

### Cross-Repo Awareness
- **Crypto changes**: If encryption behavior changes, check `expo-libsignal-dezire` and `libsignal-dezire` first.
- **API changes**: If the server contract changes, check the `deezchatz-api` docs. The backend uses a dual-port architecture (3000 public, 3001 private).

## Project Overview

DeezChatz is a React Native mobile messaging app built with Expo SDK 57.
It uses the file-based routing system (`expo-router`) and integrates native Rust
Signal protocol cryptography via the `expo-libsignal-dezire` package.

## Technology Stack

- **Runtime**: Expo SDK 57 with React 19.2 and React Native 0.86
- **Package Manager**: Bun (use `bun` for all package operations)
- **Routing**: expo-router v57 (file-based routing in `src/app/`)
- **State Management**: Zustand with `expo-secure-store` persistence
- **Language**: TypeScript with strict mode enabled
- **Native Code**: Native Expo modules with Rust FFI (`expo-libsignal-dezire`, `expo-native-mqtt`)
- **Testing**: Jest with `jest-expo` and React Native Testing Library

## Build/Lint/Test Commands

```bash
# Development
bun start                    # Start Expo dev server
bun ios-sim                  # Build and run on iOS simulator
bun ios                      # Build and run on iOS device
bun android                  # Build and run on Android

# Testing & Linting
bun run test                 # Run Jest unit test suite
bun lint                     # Run ESLint (expo lint)

# Package management
bun install                  # Install dependencies
bun add <package>            # Add a package
```

## Project Structure

```
src/
  app/                    # File-based routes (expo-router)
    (tabs)/               # Tab navigator group
    register/             # Registration flow
    chat/                 # Chat screens
    _layout.tsx           # Root layout
  components/             # Reusable UI components (Styled*)
  hooks/                  # Custom hooks (useTheme, etc.)
  store/                  # Zustand stores
  static/                 # Static data (colors, constants)
  utils/                  # Utility functions (crypto, transport, storage, messaging)
  assets/                 # Images, fonts
  polyfills/              # Platform polyfills
tests/                    # Jest testing suite
  setup.ts                # Test environment & mock setup
  store/                  # Store unit tests
.github/
  workflows/              # GitHub Actions (build-android.yml)
```

## Code Style Guidelines

### Imports

Order imports as follows (separated by blank lines):
1. React and React Native core
2. Expo packages
3. Third-party packages
4. Internal modules using `@/` path alias
5. Relative imports

```typescript
import React, { useState, useMemo } from "react";
import { View, StyleSheet, Platform } from "react-native";

import { router } from "expo-router";
import * as Crypto from "expo-crypto";

import { MaterialIcons } from "@expo/vector-icons";

import { useTheme, useThemedStyles } from "@/src/hooks/useTheme";
import StyledButton from "@/src/components/StyledButton";

import { getContacts } from "./getContacts";
```

### TypeScript

- Strict mode is enabled; avoid `any` types
- Define explicit types for function parameters and return values
- Use type exports alongside value exports: `export { getContacts, SplitContact }`
- Prefer interfaces for object shapes, types for unions/intersections
- Use `Uint8Array` for binary data (crypto operations)

### Naming Conventions

- **Files**: camelCase for utilities/hooks, PascalCase for components
- **Components**: PascalCase (`StyledButton`, `ContactModal`)
- **Hooks**: camelCase with `use` prefix (`useTheme`, `useSession`)
- **Stores**: camelCase with `use` prefix (`useSession`)
- **Types**: PascalCase (`KeyPair`, `SplitContact`, `ThemeColors`)
- **Constants**: UPPER_SNAKE_CASE or camelCase object exports

### Component Patterns

Use functional components with hooks. Export as default for route components:

```typescript
export default function ScreenName() {
  const { colors } = useTheme();
  // ...
}
```

For shared components, use named exports with default:

```typescript
const StyledButton = ({ style, variant = "default", ...props }) => {
  // ...
};
export default StyledButton;
```

### Styling

Use `useThemedStyles` hook for theme-aware styles (memoized):

```typescript
const styles = useThemedStyles((colors) => ({
  container: {
    backgroundColor: colors.backgroundPrimary,
    color: colors.textPrimary,
  },
}));
```

For dynamic styles based on props/state, use `useMemo` with `StyleSheet.create`:

```typescript
const dynamicStyle = useMemo(
  () => StyleSheet.create({ ... }),
  [colors, insets]
);
```

### Theme Colors

Access colors via the `useTheme` hook. Available semantic colors:
- Text: `textPrimary`, `textSecondary`, `textTertiary`
- Background: `backgroundPrimary`, `backgroundSecondary`, `backgroundTertiary`
- Accent: `accentPrimary`, `accentPrimaryDark`
- Semantic: `success`, `warning`, `error`, `info`
- UI: `card`, `border`, `overlay`, `shadow`

### State Management

Use Zustand stores in `src/store/`. Pattern with secure persistence:

```typescript
const useSession = create(
  persist<SessionType>(
    (set) => ({ ... }),
    {
      name: "session",
      storage: createJSONStorage(() => ({
        setItem,
        getItem,
        removeItem: deleteItemAsync,
      })),
    }
  )
);
export default useSession;
```

### Error Handling

Use `Alert.alert()` for user-facing errors in React Native:

```typescript
Alert.alert("Error", "Description of what went wrong", [
  { text: "OK", style: "cancel" },
]);
```

For async operations, use try/catch and handle errors gracefully.

### Platform-Specific Code

Use `Platform.OS` checks or platform-specific file extensions:
- `contacts.ios.tsx` - iOS-specific implementation
- `contacts.tsx` - Default/Android implementation

```typescript
import { Platform } from "react-native";

const styles = {
  bottom: Platform.OS === "ios" ? insets.bottom + 55 : insets.bottom + 120,
};
```

### Native Modules

The `expo-libsignal-dezire` package provides cryptographic operations:

```typescript
import LibsignalDezireModule from "expo-libsignal-dezire";

const keypair = await LibsignalDezireModule.genKeyPair();
const signature = await LibsignalDezireModule.vxeddsaSign(key, message);
```

For **Double Ratchet** (ongoing messaging encryption):
- Uses `RatchetSession` (TS) wrapping `expo-libsignal-dezire` (Rust FFI).
- Handles `ratchetInitSender`, `ratchetInitReceiver`, `ratchetEncrypt`, `ratchetDecrypt`.
- Manages opaque pointers to Rust `RatchetState` in native maps (`ratchetSessions`).

### Backend & Transport

- Communicates with **DeezChatz API** (REST) on port 3000 for registration and key discovery.
- Uses **RMQTT broker** over TLS for real-time messaging.
- *Note*: The backend API has a private port 3001 used internally for offline webhooks. Mobile clients never communicate with port 3001.

### Expo Router

Routes are defined by file structure in `src/app/`:
- `(tabs)/` - Tab group layout
- `[param].tsx` - Dynamic routes
- `_layout.tsx` - Layout wrappers

Use `Stack.Protected` for conditional route guards based on auth state.

## Important Notes

- React Compiler is enabled (`experiments.reactCompiler: true`)
- New Architecture is enabled (`newArchEnabled: true`)
- Typed routes enabled (`experiments.typedRoutes: true`)
- Use `expo-secure-store` for sensitive data persistence
- Avoid direct console.log in production code

## Native Module Details (expo-libsignal-dezire)

The native module package acts as a bridge to a Rust C-FFI library for Signal Protocol operations.

### Key Features
1. **X3DH**:
   - `x3dhInitiator` (Alice): Generates shared secret + ephemeral key.
   - `x3dhResponder` (Bob): Reconstructs shared secret from keys.
2. **Double Ratchet**:
   - `ratchetInitSender` / `ratchetInitReceiver`: Initializes session.
   - `ratchetEncrypt` / `ratchetDecrypt`: Message encryption.
   - `ratchetFree`: **CRITICAL** - Manually free Rust memory when session ends.

### Memory Management
- The Ratchet state is held in Rust heap memory.
- Native modules (Swift/Kotlin) store pointers to this state in a `ratchetSessions` map, keyed by a UUID string.
- The TS `RatchetSession` class automatically calls `ratchetFree` in its `close()` method.
- **Always ensure `close()` is called** to prevent memory leaks.

### FFI Architecture
- **Rust**: Exposes C-compatible functions (`extern "C"`).
- **iOS (Swift)**: Uses `UnsafeMutablePointer` to interact with C bindings.
- **Android (Kotlin)**: Uses JNI `long` to store pointers.

## Testing & Verification

Automated unit tests are written with **Jest** and **React Native Testing Library**.

- **Unit Tests**: Located in `tests/store/` (e.g. `useSession.test.ts`, `useMqttStore.test.ts`) and configured with `tests/setup.ts`.
- **Run Tests**: `bun run test`
- **Integration**: Verification scripts in `src/utils/` (e.g., `verifyRatchet.ts`) test crypto flows.
- **Manual**: Run the app on simulator/device and verify chat flows.

## CI/CD Pipeline

Automated Android APK builds are handled via GitHub Actions in `.github/workflows/build-android.yml`.
- Runs local EAS builds on Ubuntu runners for releases or manual triggers (`workflow_dispatch`).
- Outputs standalone `deezchatz-*.apk` binaries attached to releases.
