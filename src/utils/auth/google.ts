import { signIn as googleSignIn, signOut as googleSignOut, GoogleSignInResult } from "expo-google-native-oauth";

export type AuthenticatedUser = {
  token: string;
  userId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

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
