import '@testing-library/jest-native/extend-expect';

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn().mockResolvedValue(new Uint8Array(32)),
  digestStringAsync: jest.fn(),
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock expo-native-mqtt
jest.mock('expo-native-mqtt', () => {
  return {
    NativeMqttClient: jest.fn().mockImplementation(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
      subscribe: jest.fn(),
      publish: jest.fn(),
      onMessage: jest.fn(),
    })),
  };
});

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
  getStringAsync: jest.fn().mockResolvedValue(''),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  Color: {
    ios: {
      systemOrange: '#FF9500',
      systemFill: '#F2F2F7',
      systemBackground: '#FFFFFF',
      secondarySystemBackground: '#F2F2F7',
      tertiarySystemBackground: '#E5E5EA',
      label: '#000000',
      secondaryLabel: '#3C3C4399',
      tertiaryLabel: '#AEAEB2',
      separator: '#C6C6C8',
      systemGreen: '#34C759',
      systemYellow: '#FFCC00',
      systemRed: '#FF3B30',
      systemTeal: '#5AC8FA',
      systemGray4: '#D1D1D6',
      systemGray5: '#E5E5EA',
    },
    android: {
      dynamic: {
        primary: '#FF9500',
        onPrimary: '#FFFFFF',
        primaryContainer: '#ffe6c2',
        onPrimaryContainer: '#e68600',
        surface: '#FFFFFF',
        onSurface: '#000000',
        surfaceContainerLow: '#F2F2F7',
        surfaceVariant: '#E5E5EA',
        onSurfaceVariant: '#3C3C4399',
        outline: '#AEAEB2',
        outlineVariant: '#C6C6C8',
        error: '#FF3B30',
        onError: '#FFFFFF',
        surfaceContainerHighest: 'rgba(0,0,0,0.1)',
        shadow: 'rgba(0,0,0,0.25)',
      },
    },
  },
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
  },
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
  }),
}));

// Mock libsignal-dezire (the Rust FFI module)
jest.mock('expo-libsignal-dezire', () => ({
  genKeyPair: jest.fn().mockResolvedValue({
    pubKey: new Uint8Array(32),
    privKey: new Uint8Array(32),
  }),
  vxeddsaSign: jest.fn().mockResolvedValue(new Uint8Array(64)),
  vxeddsaVerify: jest.fn().mockResolvedValue(true),
  x3dhInitiator: jest.fn().mockResolvedValue({
    sharedSecret: new Uint8Array(32),
    ephemeralPubKey: new Uint8Array(32),
  }),
  x3dhResponder: jest.fn().mockResolvedValue(new Uint8Array(32)),
  ratchetInitSender: jest.fn().mockResolvedValue('mock-session-id-123'),
  ratchetInitReceiver: jest.fn().mockResolvedValue('mock-session-id-123'),
  ratchetEncrypt: jest.fn().mockResolvedValue({
    ciphertext: new Uint8Array(32),
    type: 1,
  }),
  ratchetDecrypt: jest.fn().mockResolvedValue(new Uint8Array(32)),
  ratchetFree: jest.fn(),
}));

