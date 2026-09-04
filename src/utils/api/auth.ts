import LibsignalDezireModule from "expo-libsignal-dezire";
import { generateOpks } from "@/src/utils/crypto/oneTimePreKeys";
import useSession from "@/src/store/useSession";
import { toBase64, toBytes } from "@/src/utils/helpers/encoding";
import { apiRequest } from "@/src/clients/apiClient";
import { normalizePhone } from "@/src/utils/helpers/phone";
import {
  GoogleIdTokenResponse,
  RegisterDeviceResponse,
  UpdateFcmTokenResponse,
} from "@/src/models/api";

/**
 * Phase 1: OAuth verification → returns server-assigned userId and state challenge.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdTokenResponse> {
  const session = useSession.getState();
  const iKey = await session.initIdentityKey();
  const pubIKey = await LibsignalDezireModule.genPubKey(iKey);

  return apiRequest<GoogleIdTokenResponse>("/register/google/id_token", {
    method: "POST",
    body: { idToken: idToken, iKey: toBase64(pubIKey) },
  });
}

/**
 * Phase 2: Device registration with signed keys and OPKs.
 */
export async function registerDevice(
  stateToken: string,
  phoneDetails: { countryCode: string; number: number },
  fcmToken?: string | null,
  userId?: string,
): Promise<RegisterDeviceResponse> {
  const session = useSession.getState();
  const targetUserId = userId || session.userId;
  if (!targetUserId) {
    throw new Error("User ID is missing for device registration.");
  }
  const { preKey, devKey } = await session.initDeviceKeys(phoneDetails);
  const iKey = session.iKey;

  const pubIKey = await LibsignalDezireModule.genPubKey(iKey);
  const pubPreKey = await LibsignalDezireModule.genPubKey(preKey);
  const pubDevKey = await LibsignalDezireModule.genPubKey(devKey);

  const { signature: preKeySign, vrf: preKeyVrf } = await LibsignalDezireModule.vxeddsaSign(iKey, pubPreKey);
  const { signature: devKeySign, vrf: devKeyVrf } = await LibsignalDezireModule.vxeddsaSign(iKey, pubDevKey);
  const { signature: stateSignature, vrf: stateVrf } = await LibsignalDezireModule.vxeddsaSign(iKey, toBytes(stateToken));
  const opksB64 = await generateOpks();

  const rawPhone = `${phoneDetails.countryCode}${phoneDetails.number}`;
  const e164Phone = normalizePhone(rawPhone, phoneDetails.countryCode) || rawPhone;

  const response = await apiRequest<RegisterDeviceResponse>("/register/device", {
    method: "POST",
    body: {
      userId: targetUserId,
      iKey: toBase64(pubIKey),
      state: stateToken,
      stateSignature: toBase64(stateSignature),
      stateVrf: toBase64(stateVrf),
      phone: e164Phone,
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

  return response;
}

/**
 * Updates the FCM push token on the server.
 */
export async function updateFcmToken(deviceId: string, fcmToken: string): Promise<UpdateFcmTokenResponse> {
  return apiRequest<UpdateFcmTokenResponse>("/device/fcm", {
    method: "POST",
    authenticated: true,
    body: { deviceId, fcmToken },
  });
}
