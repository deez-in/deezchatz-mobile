import { signIn as googleSignIn, signOut as googleSignOut, GoogleSignInResult } from "expo-google-native-oauth";
import LibsignalDezireModule from "expo-libsignal-dezire";
import { generateOpks } from "@/src/utils/crypto/oneTimePreKeys";
import useSession from "@/src/store/useSession";
import { toBase64, toBytes } from "@/src/utils/helpers/encoding";
import { apiRequest } from "@/src/utils/transport/api";

export type AuthenticatedUser = {
  token: string;
  userId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

export class GoogleAuthFlowError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "GoogleAuthFlowError";
  }
}

function normalizeError(error: unknown): GoogleAuthFlowError {
  if (error instanceof GoogleAuthFlowError) {
    return error;
  }

  if (error instanceof Error) {
    const maybeCode = (error as Error & { code?: unknown }).code;
    return new GoogleAuthFlowError(
      typeof maybeCode === "string" ? maybeCode : "ERR_GOOGLE_AUTH_UNKNOWN",
      error.message,
    );
  }

  return new GoogleAuthFlowError(
    "ERR_GOOGLE_AUTH_UNKNOWN",
    "Something went wrong while signing in with Google.",
  );
}

export async function isGoogleSignInAvailable(): Promise<boolean> {
  return googleSignIn !== undefined;
}

export async function signOutFromGoogle(): Promise<void> {
  await googleSignOut();
}

export async function startGoogleSignIn(): Promise<AuthenticatedUser> {
  let nativeResult: GoogleSignInResult;

  try {
    nativeResult = await googleSignIn();
  } catch (error) {
    throw normalizeError(error);
  }

  return {
    token: nativeResult.idToken ?? "",
    userId: nativeResult.googleUserId ?? nativeResult.email ?? "unknown",
    email: nativeResult.email,
    displayName: nativeResult.displayName,
    avatarUrl: nativeResult.avatarUrl,
  };
}

// Phase 1: OAuth verification → returns server-assigned userId and state challenge
export async function verifyGoogleIdToken(idToken: string): Promise<{
  userId: string;
  state: string;
  email: string;
  name: string | null;
  picture: string | null;
}> {
  const session = useSession.getState();
  const iKey = await session.initIdentityKey();
  const pubIKey = await LibsignalDezireModule.genPubKey(iKey);

  return apiRequest("/register/google/id_token", {
    method: "POST",
    body: { idToken: idToken, iKey: toBase64(pubIKey) },
  });
}

// Phase 2: Device + key registration
export async function registerDevice(
  stateToken: string,
  phoneDetails: { countryCode: string; number: number },
  fcmToken?: string | null,
): Promise<string> {
  const session = useSession.getState();
  const { preKey, devKey } = await session.initDeviceKeys(phoneDetails);
  const iKey = session.iKey;

  const pubPreKey = await LibsignalDezireModule.genPubKey(preKey);
  const pubDevKey = await LibsignalDezireModule.genPubKey(devKey);

  const { signature: preKeySign, vrf: preKeyVrf } = await LibsignalDezireModule.vxeddsaSign(iKey, pubPreKey);
  const { signature: devKeySign, vrf: devKeyVrf } = await LibsignalDezireModule.vxeddsaSign(iKey, pubDevKey);
  const { signature: stateSignature, vrf: stateVrf } = await LibsignalDezireModule.vxeddsaSign(iKey, toBytes(stateToken));
  const opksB64 = await generateOpks();

  const response = await apiRequest<{ status: string; userId: string; deviceId: string }>("/register/device", {
    method: "POST",
    body: {
      state: stateToken,
      stateSignature: toBase64(stateSignature),
      stateVrf: toBase64(stateVrf),
      phone: `${phoneDetails.countryCode}${phoneDetails.number}`,
      signedPreKey: toBase64(pubPreKey),
      preKeySign: toBase64(preKeySign),
      preKeyVrf: toBase64(preKeyVrf),
      opks: opksB64,
      signedDeviceKey: toBase64(pubDevKey),
      devKeySign: toBase64(devKeySign),
      devKeyVrf: toBase64(devKeyVrf),
      fcmToken: fcmToken ?? undefined,
    },
  });

  return response.deviceId;
}
