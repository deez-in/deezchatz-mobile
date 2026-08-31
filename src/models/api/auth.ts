export interface GoogleIdTokenResponse {
  status: "success";
  userId: string;
  state: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export interface RegisterDeviceRequest {
  state: string;
  stateSignature: string;
  stateVrf: string;
  phone: string;
  signedPreKey: string;
  preKeySign: string;
  preKeyVrf: string;
  opks?: string[];
  signedDeviceKey: string;
  devKeySign: string;
  devKeyVrf: string;
  fcmToken?: string;
}

export interface RegisterDeviceResponse {
  status: "success";
  userId: string;
  deviceId: string;
}

export interface UpdateFcmTokenRequest {
  deviceId: string;
  fcmToken: string;
}

export interface UpdateFcmTokenResponse {
  status: string;
  message: string;
}
