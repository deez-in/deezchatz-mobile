import { x3dhInitiator, x3dhResponder } from "@/src/utils/crypto/x3dh";
import { PreKeyBundle, X3DHBundle } from "@/src/models/crypto";
import LibsignalDezireModule from "expo-libsignal-dezire";
import { Session } from "@/src/models/store";
import { toBase64 } from "@/src/utils/helpers/encoding";

describe("X3DH Protocol Integration", () => {
  const mockSession = {
    iKey: new Uint8Array(32).fill(1),
    preKey: new Uint8Array(32).fill(2),
    devKey: new Uint8Array(32).fill(3),
    userId: "test-user-id",
    deviceId: "test-dev-id",
  } as unknown as Session;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should correctly serialize bob bundle with spkId and call x3dhInitiator", async () => {
    const dummyKey33 = toBase64(new Uint8Array(33).fill(5));
    const dummySig96 = toBase64(new Uint8Array(96).fill(6));

    const bundle: PreKeyBundle = {
      userId: "bob-uuid",
      phone: "+1234567890",
      deviceId: "bob-device-1",
      identityKey: dummyKey33,
      spkId: 42,
      signedPreKey: dummyKey33,
      signature: dummySig96,
      opk: {
        id: 7,
        key: dummyKey33,
      },
    };

    (LibsignalDezireModule.x3dhInitiator as jest.Mock).mockResolvedValueOnce({
      sharedSecret: new Uint8Array(32).fill(9),
      ephemeralPublic: new Uint8Array(32).fill(10),
    });

    const result = await x3dhInitiator(mockSession, bundle);

    expect(LibsignalDezireModule.x3dhInitiator).toHaveBeenCalledTimes(1);
    const [iKey, bobBundle, hasOpk] = (LibsignalDezireModule.x3dhInitiator as jest.Mock).mock.calls[0];

    expect(iKey).toEqual(mockSession.iKey);
    expect(hasOpk).toBe(true);

    // Verify serialized binary buffer:
    // bytes 33-36: spkId (42 in uint32 little-endian)
    const view = new DataView(bobBundle.buffer, bobBundle.byteOffset, bobBundle.byteLength);
    expect(view.getUint32(33, true)).toBe(42);
    // bytes 166-169: opkId (7 in uint32 little-endian)
    expect(view.getUint32(166, true)).toBe(7);

    expect(result.sharedSecret).toEqual(new Uint8Array(32).fill(9));
    expect(result.ephemeralKey).toEqual(new Uint8Array(32).fill(10));
  });

  it("should default spkId to 1 when omitted in bundle", async () => {
    const dummyKey33 = toBase64(new Uint8Array(33).fill(5));
    const dummySig96 = toBase64(new Uint8Array(96).fill(6));

    const bundle: PreKeyBundle = {
      userId: "bob-uuid",
      phone: "+1234567890",
      deviceId: "bob-device-1",
      identityKey: dummyKey33,
      signedPreKey: dummyKey33,
      signature: dummySig96,
    };

    (LibsignalDezireModule.x3dhInitiator as jest.Mock).mockResolvedValueOnce({
      sharedSecret: new Uint8Array(32).fill(9),
      ephemeralPublic: new Uint8Array(32).fill(10),
    });

    await x3dhInitiator(mockSession, bundle);

    const [, bobBundle, hasOpk] = (LibsignalDezireModule.x3dhInitiator as jest.Mock).mock.calls[0];
    expect(hasOpk).toBe(false);

    const view = new DataView(bobBundle.buffer, bobBundle.byteOffset, bobBundle.byteLength);
    expect(view.getUint32(33, true)).toBe(1);
  });

  it("should correctly invoke x3dhResponder with session keys", async () => {
    const dummyKey33 = toBase64(new Uint8Array(33).fill(5));

    const bundle: X3DHBundle = {
      identityKey: dummyKey33,
      ephemeralKey: dummyKey33,
      spkId: 1,
      opkId: 4,
    };

    const opkPrivate = new Uint8Array(32).fill(8);

    (LibsignalDezireModule.x3dhResponder as jest.Mock).mockResolvedValueOnce({
      sharedSecret: new Uint8Array(32).fill(99),
    });

    const secret = await x3dhResponder(mockSession, bundle, opkPrivate);

    expect(LibsignalDezireModule.x3dhResponder).toHaveBeenCalledWith(
      mockSession.iKey,
      mockSession.preKey,
      opkPrivate,
      expect.any(Uint8Array),
      expect.any(Uint8Array)
    );
    expect(secret).toEqual(new Uint8Array(32).fill(99));
  });
});
