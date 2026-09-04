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
  const mockMqttClient = {
    connect: jest.fn().mockResolvedValue('connected'),
    disconnect: jest.fn().mockResolvedValue('disconnected'),
    subscribe: jest.fn().mockResolvedValue('subscribed'),
    unsubscribe: jest.fn().mockResolvedValue('unsubscribed'),
    publish: jest.fn().mockResolvedValue('published'),
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  };

  return {
    __esModule: true,
    default: mockMqttClient,
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

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid-v4'),
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => {
  class MockDirectory {
    get exists(): boolean {
      return true;
    }
    uri: string;
    constructor(...uris: any[]) {
      this.uri = uris
        .map((u) => (typeof u === 'object' && u?.uri ? u.uri : String(u)))
        .join('/');
    }
    create(): void {}
  }

  class MockFile {
    get exists(): boolean {
      return true;
    }
    uri: string;
    content: Uint8Array = new Uint8Array([1, 2, 3]);
    constructor(...uris: any[]) {
      this.uri = uris
        .map((u) => (typeof u === 'object' && u?.uri ? u.uri : String(u)))
        .join('/');
    }
    create(): void {}
    write(bytes: Uint8Array): void {
      this.content = bytes;
    }
    async copy(target: MockFile): Promise<void> {
      target.content = this.content;
    }
    async arrayBuffer(): Promise<ArrayBuffer> {
      return this.content.buffer.slice(
        this.content.byteOffset,
        this.content.byteOffset + this.content.byteLength
      ) as ArrayBuffer;
    }
    delete(): void {}
  }

  return {
    Directory: MockDirectory,
    File: MockFile,
    Paths: {
      document: { uri: '/mock/documents' },
      cache: { uri: '/mock/cache' },
    },
  };
});

const mockPlaybackListeners = new Set<(status: any) => void>();
export const mockEmitPlaybackStatus = (status: any) => {
  mockPlaybackListeners.forEach((fn) => fn(status));
};

// Mock expo-audio-opus
jest.mock('expo-audio-opus', () => ({
  __esModule: true,
  default: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true, canAskAgain: true }),
    getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true, canAskAgain: true }),
    startRecording: jest.fn().mockResolvedValue(undefined),
    stopRecording: jest.fn().mockResolvedValue({
      uri: 'file:///mock/cache/recording_mock.opus',
      durationMs: 5000,
      fileSize: 15000,
    }),
    pauseRecording: jest.fn().mockResolvedValue(undefined),
    resumeRecording: jest.fn().mockResolvedValue(undefined),
    startPlayback: jest.fn().mockResolvedValue({ durationMs: 5000, channels: 1, sampleRate: 48000 }),
    stopPlayback: jest.fn().mockResolvedValue(undefined),
    pausePlayback: jest.fn().mockResolvedValue(undefined),
    resumePlayback: jest.fn().mockResolvedValue(undefined),
    seekTo: jest.fn().mockResolvedValue(undefined),
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    removeListeners: jest.fn(),
  },
  addRecordingMeteringListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  addPlaybackStatusListener: jest.fn((listener: (status: any) => void) => {
    mockPlaybackListeners.add(listener);
    return {
      remove: jest.fn(() => mockPlaybackListeners.delete(listener)),
    };
  }),
}));

// Mock expo-contacts
jest.mock('expo-contacts', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
  getContactsAsync: jest.fn().mockResolvedValue({ data: [] }),
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
  Fields: {},
  SortTypes: {},
}));


